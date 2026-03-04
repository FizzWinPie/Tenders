import logging
from typing import Any

import requests

from app.core.config import DEFAULT_TED_FIELDS, EU_TENDER_API_KEY, TED_API_URL

logger = logging.getLogger(__name__)


def search_tenders(
    query: str,
    *,
    api_key: str | None = None,
    fields: list[str] | None = None,
    limit: int = 10,
    page: int = 1,
    scope: str = "ACTIVE",
) -> tuple[list[dict[str, Any]], int]:
    """Call TED notices search API. Returns (tender dicts, total count). Total from API when present else len(tenders)."""
    key = api_key or EU_TENDER_API_KEY
    if not key:
        logger.error("EU_TENDER_API_KEY not set")
        return [], 0

    url = TED_API_URL
    body = {
        "query": query,
        "fields": fields or DEFAULT_TED_FIELDS,
        "limit": limit,
        "page": page,
        "scope": scope,
    }
    headers = {
        "X-API-KEY": key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = requests.post(url, json=body, headers=headers)
        if response.status_code != 200:
            logger.error(
                "Tender API call failed. Status: %s, Response: %s",
                response.status_code,
                response.text,
            )
            return [], 0

        data = response.json()
        tenders = []
        for notice in data.get("notices", []):
            pdf = (notice.get("links") or {}).get("pdf") or {}
            pdf_url = pdf.get("DEU") or pdf.get("ENG")
            publication_id = notice.get("publication-number")
            if pdf_url and publication_id:
                tenders.append(
                    {
                        "id": publication_id,
                        "pdf_link": pdf_url,
                        "lot_identifier": notice.get("BT-137-Lot") or [],
                        "lot_title": notice.get("BT-21-Lot") or {},
                        "lot_description": notice.get("BT-24-Lot") or {},
                        "lot_procedure_id": notice.get("BT-22-Lot") or [],
                    }
                )
        total = data.get("total") or data.get("totalCount") or data.get("numberOfResults")
        if total is not None:
            try:
                total = int(total)
            except (TypeError, ValueError):
                total = len(tenders)
        else:
            total = len(tenders)
        return tenders, total

    except requests.exceptions.RequestException as e:
        logger.error("Tender API request failed: %s", e)
        return [], 0
