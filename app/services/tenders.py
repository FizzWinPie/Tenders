from app.clients.ted import search_tenders
from app.schemas.tenders import TenderSearchRequest

from app.core.config import (
    DEFAULT_BUYER_COUNTRIES,
    DEFAULT_SUBMISSION_LANGUAGES,
)


def build_ted_query(filters: TenderSearchRequest, default_date: str) -> str:
    """Build TED API query string from validated request. Uses allowlisted clauses only."""
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
    if filters.notice_types:
        or_part = " OR ".join(t.lower().strip() for t in filters.notice_types)
        clauses.append(f"notice-type=({or_part})")
    if filters.keyword and filters.keyword.strip():
        clauses.append(f"FT~'{filters.keyword.strip()}'")
    return " AND ".join(clauses)


def search_all_tenders(filters: TenderSearchRequest, default_date: str) -> list[dict]:
    """Run filtered tender search via TED API; returns list of tender dicts."""
    query = build_ted_query(filters, default_date)
    return search_tenders(query)
