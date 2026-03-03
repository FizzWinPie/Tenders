from contextlib import asynccontextmanager
import requests
from dotenv import load_dotenv
import os
from datetime import date
from sqlalchemy.orm import Session
from google import genai
from google.genai import errors as genai_errors
from fastapi import Depends, FastAPI, Query, Request
from pydantic import BaseModel, Field
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


class TenderSearchRequest(BaseModel):
    """User inputs for tender search. All filters are optional with defaults."""

    input_date: str | None = Field(
        default=None,
        description="Publication date YYYYMMDD. Defaults to today.",
        examples=["20260302"],
    )
    keyword: str = Field(
        ...,
        description="Full-text search term (e.g. SAP).",
        min_length=1,
        examples=["SAP"],
    )


def build_ted_query(filters: TenderSearchRequest, default_date: str) -> str:
    """Build TED API query string from validated request. Uses allowlisted clauses only."""
    publication_date = filters.input_date or default_date
    keyword = filters.keyword.strip()
    clauses = [
        "submission-language IN (ENG DEU)",
        "buyer-country IN (AUT DEU CHE)",
        f"publication-date={publication_date}",
        f"FT~'{keyword}'",
    ]
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
    publication_date = body.input_date or default_date
    return {
        "publication_date": publication_date,
        "total_count": len(tenders),
        "tenders": tenders,
    }
