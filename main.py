from contextlib import asynccontextmanager
import requests
from dotenv import load_dotenv
import os
from datetime import date
from sqlalchemy.orm import Session
from google import genai
from google.genai import errors as genai_errors
from fastapi import Depends, FastAPI, Query, Request
from pydantic import BaseModel
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

# change to add query as FT~{text such as SAP} for filtering where word is present
# add field as "publication-lot"   # get description at 5. Lot 5.1 -> only feed this to agent
def search_all_tenders(publication_date: str, keyword: str):
    tenders = []
    url = "https://api.ted.europa.eu/v3/notices/search"
    body = {
        "query": f"submission-language IN (ENG DEU) AND buyer-country IN (AUT DEU CHE) AND publication-date={publication_date} AND FT~'{keyword}'",
        "fields": [  
            "publication-number",   # Notice ID ex. 144585-2026
            "links",                # pdf, xml, html links
            "BT-137-Lot",           # Lot identifier ex. LOT-0001
            "BT-21-Lot",            # Lot title
            "BT-24-Lot",            # Lot description
            "BT-22-Lot"             # Lot Procedure Internal identifier
        ],
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
def run_filtered_search(input_date: str, keyword: str, db: Session = Depends(get_db)):
    today = date.today()
    if not input_date:
        input_date = f"{today.year}{today.month:02d}{today.day:02d}"

    tenders = search_all_tenders(input_date, keyword)
    total_number_tenders = len(tenders)

    return {
        "publication_date": input_date,
        "total": total_number_tenders,
        "relevant_count": total_number_tenders,
        "tenders": tenders,
    }
