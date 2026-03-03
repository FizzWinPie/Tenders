import json
import logging
import os
from datetime import date

from google import genai
from google.genai import errors as genai_errors

logger = logging.getLogger(__name__)


def agent_search(input_data):
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    agent_context = """
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

    content = (
        input_data
        if isinstance(input_data, str)
        else "\n\n---\n\n".join(str(t) for t in input_data)
    )

    try:
        res = client.models.generate_content(
            model=os.getenv("GEMINI_AGENT_MODEL") or "gemini-2.5-flash-lite",
            contents=f"{agent_context}. These are the tenders: {content}",
        )
    except genai_errors.ClientError as e:
        logger.warning(
            "Gemini client error (max quota limit reached) during agent_search: %s", e
        )
        return None
    except genai_errors.ServerError as e:
        logger.warning(
            "Gemini service unavailable during agent_search: %s",
            e,
        )
        return None
    except Exception:
        logger.exception("Unexpected error during agent_search")
        return None

    raw_text = getattr(res, "text", None) or ""
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse agent_search response as JSON: %s", raw_text)
        return None

    if not isinstance(parsed, dict) or "relevant" not in parsed:
        logger.warning(
            "agent_search returned JSON without required keys: %s",
            parsed,
        )
        return None

    results_path = "results.json"
    if os.path.exists(results_path):
        with open(results_path, "r", encoding="utf-8") as f:
            results = json.load(f)
    else:
        results = []
    results.append({"response": parsed, "timestamp": date.today().isoformat()})
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    return parsed

