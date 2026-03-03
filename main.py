from contextlib import asynccontextmanager
import requests
from dotenv import load_dotenv
import os
from datetime import date
from sqlalchemy.orm import Session
from google import genai
from google.genai import errors as genai_errors
from fastapi import Depends, FastAPI, Query, Request
from pydantic import BaseModel, Field, model_validator
from typing import Literal
import logging
from fastapi.responses import JSONResponse
from db import Base, engine, get_db
from models import Run, Tender, TenderAnalysis

load_dotenv()

logging.basicConfig(
    level = logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

logger = logging.getLogger(__name__)

DEFAULT_TED_FIELDS = [
            "publication-number",   # Notice ID ex. 144585-2026
            "links",                # pdf, xml, html links
            "BT-137-Lot",           # Lot identifier ex. LOT-0001
            "BT-21-Lot",            # Lot title
            "BT-24-Lot",            # Lot description
            "BT-22-Lot"             # Lot Procedure Internal identifier
]

ALLOWED_SUBMISSION_LANGUAGES = {"ENG", "DEU", "FRA", "ITA", "ESP", "NLD", "POL", "ELL"}
DEFAULT_SUBMISSION_LANGUAGES = ["ENG", "DEU"]

ALLOWED_BUYER_COUNTRIES = {"AUT", "DEU", "CHE", "FRA", "ITA", "ESP", "NLD", "POL", "BEL", "HRV"}
DEFAULT_BUYER_COUNTRIES = ["AUT", "DEU", "CHE"]


class TenderSearchRequest(BaseModel):
    """User inputs for tender search. All filters are optional with defaults."""

    date_mode: Literal["exact", "range"] = Field(
        default="exact",
        description="Use a single publication date ('exact') or a date range ('range').",
    )
    input_date: str | None = Field(
        default=None,
        description="Publication date YYYYMMDD (used when date_mode='exact'). Defaults to today.",
        examples=["20260302"],
    )
    date_from: str | None = Field(
        default=None,
        description="Start of range YYYYMMDD (required when date_mode='range').",
        examples=["20260301"],
    )
    date_to: str | None = Field(
        default=None,
        description="End of range YYYYMMDD (required when date_mode='range').",
        examples=["20260302"],
    )
    keyword: str = Field(
        ...,
        description="Full-text search term (e.g. SAP).",
        min_length=1,
        examples=["SAP"],
    )
    submission_languages: list[str] | None = Field(
        default=None,
        description="Submission languages (3-letter codes, e.g. ENG, DEU). Uses allowlist. Default: ENG, DEU.",
        examples=[["ENG", "DEU"]],
    )
    buyer_countries: list[str] | None = Field(
        default=None,
        description="Buyer countries (3-letter codes, e.g. AUT, DEU, CHE). Uses allowlist. Default: AUT, DEU, CHE.",
        examples=[["AUT", "DEU", "CHE"]],
    )

    @model_validator(mode="after")
    def check_range_dates(self):
        if self.date_mode == "range" and (not self.date_from or not self.date_to):
            raise ValueError("date_from and date_to are required when date_mode='range'")
        return self

    @model_validator(mode="after")
    def check_languages_countries(self):
        if self.submission_languages is not None:
            if not self.submission_languages:
                raise ValueError("submission_languages must not be empty when provided")
            invalid = {s.upper() for s in self.submission_languages} - ALLOWED_SUBMISSION_LANGUAGES
            if invalid:
                raise ValueError(f"submission_languages must be from {sorted(ALLOWED_SUBMISSION_LANGUAGES)}, got {invalid}")
        if self.buyer_countries is not None:
            if not self.buyer_countries:
                raise ValueError("buyer_countries must not be empty when provided")
            invalid = {c.upper() for c in self.buyer_countries} - ALLOWED_BUYER_COUNTRIES
            if invalid:
                raise ValueError(f"buyer_countries must be from {sorted(ALLOWED_BUYER_COUNTRIES)}, got {invalid}")
        return self


def build_ted_query(filters: TenderSearchRequest, default_date: str) -> str:
    """Build TED API query string from validated request. Uses allowlisted clauses only."""
    keyword = filters.keyword.strip()
    langs = filters.submission_languages or DEFAULT_SUBMISSION_LANGUAGES
    countries = filters.buyer_countries or DEFAULT_BUYER_COUNTRIES
    clauses = [
        "submission-language IN (" + " ".join(s.upper() for s in langs) + ")",
        "buyer-country IN (" + " ".join(c.upper() for c in countries) + ")",
    ]
    if filters.date_mode == "range" and filters.date_from and filters.date_to:
        clauses.append(
            f"publication-date>={filters.date_from} AND publication-date<={filters.date_to}"
        )
    else:
        publication_date = filters.input_date or default_date
        clauses.append(f"publication-date={publication_date}")
    clauses.append(f"FT~'{keyword}'")
    return " AND ".join(clauses)


# change to add query as FT~{text such as SAP} for filtering where word is present
# add field as "publication-lot"   # get description at 5. Lot 5.1 -> only feed this to agent
def search_all_tenders(filters: TenderSearchRequest, default_date: str):
    tenders = []
    url = "https://api.ted.europa.eu/v3/notices/search"
    body = {
        "query": build_ted_query(filters, default_date),
        "fields": DEFAULT_TED_FIELDS,
        "limit": 10,
        "page": 1,
        "scope": "ACTIVE",
    }

    headers = {
        "X-API-KEY": os.getenv("EU_TENDER_API_KEY"),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = requests.post(url, json=body, headers=headers)

        if response.status_code != 200:
            logger.error("Tender API call failed. Status: %s, Response: %s", response.status_code, response.text)
            return []

        data = response.json()
        for notice in data.get("notices", []):
            pdf = (notice.get("links") or {}).get("pdf") or {}
            pdf_url = pdf.get("DEU") or pdf.get("ENG")
            publication_id = notice.get("publication-number")
            lot_identifier = notice.get("BT-137-Lot")
            lot_title = notice.get("BT-21-Lot")
            lot_description = notice.get("BT-24-Lot")
            lot_procedure_id = notice.get("BT-22-Lot")

            if pdf_url and publication_id:
                tenders.append(
                    {
                        "id": publication_id,
                        "pdf_link": pdf_url,
                        "lot_identifier": lot_identifier,
                        "lot_title": lot_title,
                        "lot_description": lot_description,
                        "lot_procedure_id": lot_procedure_id,
                    }
                )
        return tenders

    except requests.exceptions.RequestException as e:
        logger.error("Tender API request failed: %s", e)
        return []

app = FastAPI()

@app.get("/")
def read_root():
    return {"message" : "Welcome to app"}

@app.get("/health")
def read_root():
    return {"message" : "Server is healthy"}

@app.get("/run-filtered-search")
def run_filtered_search_get(
    input_date: str | None = None,
    keyword: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """GET variant: pass input_date and keyword as query params."""
    today = date.today()
    default_date = f"{today.year}{today.month:02d}{today.day:02d}"
    filters = TenderSearchRequest(input_date=input_date or None, keyword=keyword)
    tenders = search_all_tenders(filters, default_date)
    publication_date = filters.input_date or default_date
    return {
        "publication_date": publication_date,
        "total_count": len(tenders),
        "tenders": tenders,
    }


@app.post("/run-filtered-search")
def run_filtered_search_post(
    body: TenderSearchRequest,
    db: Session = Depends(get_db),
):
    """POST variant: pass input_date and keyword in JSON body. Preferred for many filters."""
    today = date.today()
    default_date = f"{today.year}{today.month:02d}{today.day:02d}"
    tenders = search_all_tenders(body, default_date)
    if body.date_mode == "range" and body.date_from and body.date_to:
        publication_date = f"{body.date_from}..{body.date_to}"
    else:
        publication_date = body.input_date or default_date
    return {
        "publication_date": publication_date,
        "total_count": len(tenders),
        "tenders": tenders,
    }
