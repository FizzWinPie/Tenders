from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import (
    ALLOWED_BUYER_COUNTRIES,
    ALLOWED_NOTICE_TYPES,
    ALLOWED_SUBMISSION_LANGUAGES,
)
from app.db import get_db
from app.schemas import (
    KeywordsFromUrlRequest,
    TenderPickRequest,
    TenderSearchRequest,
    TenderWinner,
)
from app.services.tenders import pick_multiple_tender_winners, search_all_tenders
from app.clients.gemini import keywords_from_url

router = APIRouter(tags=["tenders"])


@router.get("/filter-options")
def get_filter_options():
    """Return allowlisted filter options for the UI (languages, countries, notice types)."""
    return {
        "submission_languages": sorted(ALLOWED_SUBMISSION_LANGUAGES),
        "buyer_countries": sorted(ALLOWED_BUYER_COUNTRIES),
        "notice_types": sorted(ALLOWED_NOTICE_TYPES),
    }


@router.post("/run-filtered-search")
def run_filtered_search(
    body: TenderSearchRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Filtered tender search. All query fields are optional; send only what you want to filter by (JSON body)."""
    today = date.today()
    default_date = f"{today.year}{today.month:02d}{today.day:02d}"
    tenders, total = search_all_tenders(body, default_date)
    if body.date_mode == "range" and body.date_from and body.date_to:
        publication_date = f"{body.date_from}..{body.date_to}"
    else:
        publication_date = body.input_date or default_date
    return {
        "publication_date": publication_date,
        "total_count": total,
        "page": body.page,
        "limit": body.limit,
        "tenders": tenders,
    }


@router.post("/pick-winners", response_model=list[TenderWinner])
def pick_winners(
    body: TenderPickRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Given a shortlist of tenders (typically 5), call the LLM up to `runs` times
    to pick distinct winners, each with a reason.
    """
    return pick_multiple_tender_winners(body)


@router.post("/extract-keywords")
def extract_keywords(body: KeywordsFromUrlRequest):
    """
    Scrape the given URL and use the LLM to extract company-context keywords.
    Returns a list of keywords suitable for tender search.
    """
    keywords = keywords_from_url(body.url)
    return {"keywords": keywords}
