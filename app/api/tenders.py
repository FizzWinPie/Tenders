from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import (
    ALLOWED_BUYER_COUNTRIES,
    ALLOWED_NOTICE_TYPES,
    ALLOWED_SUBMISSION_LANGUAGES,
)
from app.db import get_db
from app.schemas import TenderSearchRequest
from app.services.tenders import search_all_tenders

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
    db: Session = Depends(get_db),
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
