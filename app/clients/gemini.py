import json
import logging
from typing import Any

from google import genai
from google.genai import errors as genai_errors

from app.core.config import GEMINI_AGENT_MODEL, GEMINI_API_KEY

from trafilatura import fetch_url, extract

logger = logging.getLogger(__name__)

AGENT_GENERAL_GUIDELINES = """
        ### ROLE
        You are a Precision Document Analyst. Your goal is to extract and analyze procurement data with 100% factual accuracy.

        ### MANDATORY GROUNDING RULES
        1. ONLY use the information provided in the [Tender Context] below.
        2. If the [Tender Context] does NOT contain the specific information requested, output "Information not available."
        3. DO NOT use external knowledge, internet data, or your own training data to fill in gaps.
        4. DO NOT infer, assume, or guess the scope of work if it is not explicitly stated.
        5. If the [Tender Context] is in a language you don't fully understand or the text is corrupted/unclear, respond with: "Unclear context - manually review required."

        ### PROHIBITIONS
        - No "hallucinating" or "making up" details.
        - No adding features or services to the tender that aren't written in the text.
        - No assuming a tender is for "S/4HANA" just because it mentions "SAP" (it must be explicitly stated).

        ### OUTPUT FORMAT
        Respond ONLY with a single valid JSON object in this exact shape:
        {
            "relevant": true or false,
            "reason": "single-sentence justification explaining why or why not"
        }
        Do not include any additional text before or after the JSON.
        """

SELECTION_GENERAL_GUIDELINES = """
        ### ROLE
        You are a Procurement Tender Selector. Your goal is to pick the single best tender for a given company from a small shortlist.

        ### INPUT
        You receive:
        - [Tender Candidates]: a JSON array of up to 5 tender objects.
        - [Already Selected IDs]: a JSON array of tender IDs that have already been chosen as winners in previous rounds.
        - Optional company information and user-specific guidelines.

        ### MANDATORY GROUNDING RULES
        1. ONLY use the information provided in the inputs (candidates, selected IDs, company info, guidelines).
        2. DO NOT use external knowledge, internet data, or your own training data to fill in gaps.
        3. If the inputs do NOT contain enough information to make a clear choice, pick the tender that appears safest and most generic, and say that in the reason.
        4. When [Already Selected IDs] is non-empty, you MUST NOT choose any tender whose ID is listed there.

        ### SELECTION RULES
        - Choose exactly ONE tender as the winner.
        - Prefer tenders that clearly match the company's domain, capabilities, or interests from the description/title.
        - If multiple tenders are equally good, break ties arbitrarily but still pick exactly one.

        ### OUTPUT FORMAT
        Respond ONLY with a single valid JSON object in this exact shape:
        {
            "winner_id": "id value of the chosen tender (as it appears in the input JSON)",
            "reason": "one concise sentence explaining why this tender is the best choice"
        }
        Do not include any additional text before or after the JSON.
        """

AGENT_SEARCH_KEYWORDS = """
        ### ROLE
        You are a Company Context Keyword Extractor. Your goal is to capture the most important concepts that describe a company's focus, services, and positioning.

        ### INPUT
        You receive free-text company information, possibly long marketing copy.

        ### OUTPUT RULES
        1. Identify the most important concise keywords or short phrases that describe:
           - products / services
           - technologies / platforms
           - target customers
           - value propositions and differentiators
        2. Prefer concrete, reusable search keywords over full sentences.
        3. Remove duplicates and near-duplicates.
        4. Sort by relevance for EU tender search: most likely to match first.

        ### OUTPUT FORMAT
        Respond ONLY with a single valid JSON array of strings, for example:
        [
          "SAP Cloud ERP",
          "SAP S/4HANA Cloud",
          "Public Cloud ERP",
          "Mittelstand",
          "Scale-ups",
          "schnelle Einführung",
          "ERP für Wachstum"
        ]
        Do not include any additional text before or after the JSON.
        """

def _extract_json_text(raw: str) -> str:
    """Strip markdown code fences (e.g. ```json ... ```) if present."""
    s = raw.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines)
    return s.strip()


def parse_agent_response(res):
    raw_text = getattr(res, "text", None) or ""
    text = _extract_json_text(raw_text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse agent_search response as JSON: %s", raw_text)
        return None

    if not isinstance(parsed, dict) or "relevant" not in parsed:
        logger.warning("agent_search returned JSON without required keys: %s", parsed)
        return None

    return parsed


def parse_selection_response(res: Any) -> dict[str, Any] | None:
    raw_text = getattr(res, "text", None) or ""
    text = _extract_json_text(raw_text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse pick_tender_winner response as JSON: %s", raw_text)
        return None

    if not isinstance(parsed, dict):
        logger.warning("pick_tender_winner returned non-dict JSON: %s", parsed)
        return None

    if "winner_id" not in parsed or "reason" not in parsed:
        logger.warning("pick_tender_winner JSON missing required keys: %s", parsed)
        return None

    return parsed


def parse_keywords_response(res: Any) -> list[str]:
    raw_text = getattr(res, "text", None) or ""
    text = _extract_json_text(raw_text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse select_keywords response as JSON: %s", raw_text)
        return []

    # Primary expected shape: JSON array of strings
    if isinstance(parsed, list):
        keywords: list[str] = []
        for item in parsed:
            if isinstance(item, str):
                kw = item.strip()
                if kw:
                    keywords.append(kw)
        return keywords

    # Be tolerant to {"keywords": [...]} shape if it ever occurs
    if isinstance(parsed, dict) and isinstance(parsed.get("keywords"), list):
        keywords = []
        for item in parsed["keywords"]:
            if isinstance(item, str):
                kw = item.strip()
                if kw:
                    keywords.append(kw)
        return keywords

    logger.warning("select_keywords returned JSON in unexpected format: %s", parsed)
    return []


def build_agent_context(
    input_data: str | list,
    company_information_data: str | None = None,
    user_specific_guidelines: str | None = None,
) -> str:
    contents = f"{AGENT_GENERAL_GUIDELINES}."
    if company_information_data:
        contents += f"\nThe Company has the following qualities: {company_information_data}"
    if user_specific_guidelines:
        contents += f"\nThe User has the following specific guidelines: {user_specific_guidelines}"
    if input_data:
        contents += f"\nThe following data is provided as JSON: {input_data}"
    return contents


def build_selection_context(
    candidates: list[dict[str, Any]],
    already_selected_ids: list[Any] | None = None,
    company_information_data: str | None = None,
    user_specific_guidelines: str | None = None,
) -> str:
    contents = f"{SELECTION_GENERAL_GUIDELINES}."
    contents += f"\n[Tender Candidates]\n{json.dumps(candidates, ensure_ascii=False)}"
    contents += (
        f"\n[Already Selected IDs]\n{json.dumps(already_selected_ids or [], ensure_ascii=False)}"
    )
    if company_information_data:
        contents += f"\nThe Company has the following qualities: {company_information_data}"
    if user_specific_guidelines:
        contents += f"\nThe User has the following specific guidelines: {user_specific_guidelines}"
    return contents


def agent_search(
    input_data: str | list,
    company_information_data: str | None = None,
    user_specific_guidelines: str | None = None,
) -> dict | None:
    """Call Gemini with tender context; return parsed {"relevant": bool, "reason": str} or None."""
    api_key = GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY not set")
        return None

    client = genai.Client(api_key=api_key)
    context = build_agent_context(input_data, company_information_data, user_specific_guidelines)
    try:
        res = client.models.generate_content(
            model=GEMINI_AGENT_MODEL,
            contents=context,
        )
    except genai_errors.ClientError as e:
        logger.warning("Gemini client error during agent_search: %s", e)
        return None
    except genai_errors.ServerError as e:
        logger.warning("Gemini service unavailable during agent_search: %s", e)
        return None
    except Exception:
        logger.exception("Unexpected error during agent_search")
        return None

    return parse_agent_response(res)


def pick_tender_winner(
    candidates: list[dict[str, Any]],
    already_selected_ids: list[Any] | None = None,
    company_information_data: str | None = None,
    user_specific_guidelines: str | None = None,
) -> dict[str, Any] | None:
    """
    Call Gemini to pick a single winning tender from `candidates`.

    Returns a dict like:
        {"winner_id": <id>, "reason": "<why this tender was chosen>"}
    or None on failure.
    """
    if not candidates:
        return None

    api_key = GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY not set")
        return None

    client = genai.Client(api_key=api_key)
    context = build_selection_context(
        candidates,
        already_selected_ids=already_selected_ids,
        company_information_data=company_information_data,
        user_specific_guidelines=user_specific_guidelines,
    )
    try:
        res = client.models.generate_content(
            model=GEMINI_AGENT_MODEL,
            contents=context,
        )
    except genai_errors.ClientError as e:
        logger.warning("Gemini client error during pick_tender_winner: %s", e)
        return None
    except genai_errors.ServerError as e:
        logger.warning("Gemini service unavailable during pick_tender_winner: %s", e)
        return None
    except Exception:
        logger.exception("Unexpected error during pick_tender_winner")
        return None

    return parse_selection_response(res)

def select_keywords(input_data: str) -> list[str]:
    """
    Extract a list of important company-context keywords from free-text input
    using Gemini. Returns an empty list on failure.
    """
    if not input_data:
        return []

    api_key = GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY not set")
        return []

    client = genai.Client(api_key=api_key)
    context = f"{AGENT_SEARCH_KEYWORDS}\n\n[Company Information]\n{input_data}"
    try:
        res = client.models.generate_content(
            model=GEMINI_AGENT_MODEL,
            contents=context,
        )
    except genai_errors.ClientError as e:
        logger.warning("Gemini client error during select_keywords: %s", e)
        return []
    except genai_errors.ServerError as e:
        logger.warning("Gemini service unavailable during select_keywords: %s", e)
        return []
    except Exception:
        logger.exception("Unexpected error during select_keywords")
        return []

    return parse_keywords_response(res)

def scrape_website(url: str) -> str | None:
    """Fetch URL and extract main text with trafilatura. Returns None on failure."""
    downloaded = fetch_url(url)
    if downloaded is None:
        return None
    return extract(downloaded)


def keywords_from_url(url: str) -> list[str]:
    """
    Scrape a company website and use Gemini to extract search keywords from its content.
    Returns a list of keywords, or an empty list if scraping or keyword extraction fails.
    """
    content = scrape_website(url)
    if not content or not content.strip():
        logger.warning("scrape_website returned no content for url=%s", url)
        return []
    return select_keywords(content)