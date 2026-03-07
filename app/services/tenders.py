from typing import Any

from app.clients.gemini import pick_tender_winner
from app.clients.ted import search_tenders
from app.schemas.tenders import TenderPickRequest, TenderWinner, TenderSearchRequest


def _build_ft_clause(keyword: str) -> str:
    """
    Build a TED API full-text (FT) clause for exact phrase match.
    The whole keyword (including spaces) is matched as one phrase, e.g. FT~"SAP Losung". If SAP in title and Losung in description it will be ignored.
    FT~"..." means exact phrase match; unquoted FT~ would allow partial matches (e.g. SAP-Losung).
    TODO: I can also make partial match for words with space.
    """
    s = keyword.strip()
    if not s:
        return ""
    escaped = s.replace("'", "''").replace('"', '\\"')
    return f'FT~"{escaped}"'


def build_ted_query(filters: TenderSearchRequest, default_date: str) -> str:
    """Build TED API query string from validated request. Uses allowlisted clauses only."""
    clauses: list[str] = []
    if filters.submission_languages:
        clauses.append(
            "submission-language IN (" + " ".join(s.upper() for s in filters.submission_languages) + ")"
        )
    if filters.buyer_countries:
        clauses.append(
            "buyer-country IN (" + " ".join(c.upper() for c in filters.buyer_countries) + ")"
        )
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
    keyword_terms = [t.strip() for t in (filters.keywords or []) if t and t.strip()]
    if keyword_terms:
        ft_clauses = [_build_ft_clause(t) for t in keyword_terms]
        ft_clauses = [c for c in ft_clauses if c]
        if ft_clauses:
            clauses.append("(" + " OR ".join(ft_clauses) + ")")
    elif filters.keyword and filters.keyword.strip():
        ft = _build_ft_clause(filters.keyword.strip())
        if ft:
            clauses.append(ft)
    return " AND ".join(clauses) + " SORT BY publication-number DESC"


def search_all_tenders(filters: TenderSearchRequest, default_date: str) -> tuple[list[dict], int]:
    """Run filtered tender search via TED API. Returns (tender dicts, total count)."""
    query = build_ted_query(filters, default_date)
    return search_tenders(
        query,
        limit=filters.limit,
        page=filters.page,
    )


def pick_multiple_tender_winners(request: TenderPickRequest) -> list[TenderWinner]:
    """
    Use the LLM to pick up to `runs` distinct winners from the provided tenders.

    Each winner includes the original tender payload and a concise reason.
    """
    tenders: list[dict[str, Any]] = request.tenders
    if not tenders:
        return []

    runs = min(max(request.runs, 1), len(tenders))
    winners: list[TenderWinner] = []
    selected_ids: set[Any] = set()

    for rank in range(1, runs + 1):
        llm_choice = pick_tender_winner(
            candidates=tenders,
            already_selected_ids=list(selected_ids),
            company_information_data=request.company_information_data,
            user_specific_guidelines=request.user_specific_guidelines,
        )
        if not llm_choice:
            break

        winner_id = llm_choice.get("winner_id")
        if winner_id in selected_ids:
            break

        matched_tender = next(
            (t for t in tenders if str(t.get("id")) == str(winner_id)),
            None,
        )
        if not matched_tender:
            break

        selected_ids.add(winner_id)
        winners.append(
            TenderWinner(
                rank=rank,
                tender=matched_tender,
                reason=str(llm_choice.get("reason") or ""),
            )
        )

    return winners
