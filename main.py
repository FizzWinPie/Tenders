from contextlib import asynccontextmanager
import requests
from dotenv import load_dotenv
import os
import json
import io
from datetime import date
import PyPDF2
from sqlalchemy.orm import Session
from google import genai
from google.genai import errors as genai_errors
from fastapi import Depends, FastAPI, Request
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

# change to add query as FY~{text such as SAP} for filtering where word is present
# add field as "publication-lot"   # get description at 5. Lot 5.1 -> only feed this to agent
def search_all_tenders(publication_date):
    tenders = []
    url = "https://api.ted.europa.eu/v3/notices/search"
    body = {
        "query": f"classification-cpv=48000000 AND submission-language IN (ENG DEU) AND buyer-country IN (AUT DEU CHE) AND publication-date={publication_date}",
        "fields": [  
            "publication-number",
            "links"
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
            if pdf_url and publication_id:
                tenders.append(
                    {
                        "id": publication_id,
                        "pdf_link": pdf_url,
                    }
                )
        return tenders

    except requests.exceptions.RequestException as e:
        logger.error("Tender API request failed: %s", e)
        return []


def get_pdf_content(link):
    try:
        res = requests.get(link)
        if res.status_code != 200:
            return None
    except requests.exceptions.RequestException as e:
        logger.error("Request to PDF failed for %s: %s", link, e)
    return res.content


def convert_pdf_content_to_text(content):
    reader = PyPDF2.PdfReader(io.BytesIO(content))
    text = "".join(
        reader.pages[i].extract_text() or "" for i in range(len(reader.pages))
    )
    return text


# TODO: figure out a way to make boolean switch cleaner
def agent_search(input):
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
        input if isinstance(input, str) else "\n\n---\n\n".join(str(t) for t in input)
    )
    try:
        res = client.models.generate_content(
            model=os.getenv("GEMINI_AGENT_MODEL") or "gemini-2.5-flash-lite", 
            contents=f"{agent_context}. These are the tenders: {content}",
        )
    except genai_errors.ClientError as e:
        logger.warning("Gemini client error (max quota limit reached) during agent_search: %s", e)
        return None
    except genai_errors.ServerError as e:
        logger.warning("Gemini service unavailable during agent_search: %s", e)
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
        logger.warning("agent_search returned JSON without required keys: %s", parsed)
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except genai_errors.ServerError as e:
        logger.error("Gemini upstream error on %s %s: %s", request.method, request.url, e)
        return JSONResponse(
            status_code=503,
            content={"detail": "Upstream AI service is temporarily unavailable."},
        )
    except Exception as e:
        logger.exception("Unhandled error on %s %s", request.method, request.url)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error."},
        )

@app.get("/")
def read_root():
    return {"message" : "Welcome to app"}

@app.get("/health")
def read_root():
    return {"message" : "Server is healthy"}

@app.get("/run")
def run_pipeline(db: Session = Depends(get_db)):
    today = date.today()
    publication_date = f"{today.year}{today.month:02d}{today.day:02d}"

    tenders = search_all_tenders(publication_date)
    total_number_tenders = len(tenders)

    run = Run(
        run_date=today.isoformat(),
        publication_date=publication_date,
    )
    db.add(run)
    db.flush()

    relevant_tenders = []

    for tender in tenders:
        link = tender["pdf_link"]
        publication_id = tender["id"]

        try:
            tender_obj = db.get(Tender, publication_id)
            if tender_obj is None:
                tender_obj = Tender(
                    id=publication_id,
                    pdf_link=link,
                    first_seen_publication_date=publication_date,
                )
                db.add(tender_obj)

            content = get_pdf_content(link)
            if not content:
                continue

            text = convert_pdf_content_to_text(content)
            ai_result = agent_search(text)

            if not ai_result:
                continue

            # ai_result is expected to be a dict like {"relevant": bool, "reason": str}
            if not isinstance(ai_result, dict):
                logger.warning("agent_search returned non-dict result for %s: %s", publication_id, ai_result)
                continue

            is_relevant = bool(ai_result.get("relevant"))
            reason = str(ai_result.get("reason") or "")

            if not is_relevant:
                continue

            analysis_row = TenderAnalysis(
                run=run,
                tender=tender_obj,
                analysis=json.dumps(ai_result, ensure_ascii=False),
            )
            db.add(analysis_row)

            relevant_tenders.append(
                {
                    "id": publication_id,
                    "pdf_link": link,
                    "relevant": True,
                    "reason": reason,
                }
            )
        except Exception:
            logger.exception("Failed processing tender %s", publication_id)
            continue

    relevant_number_tenders = len(relevant_tenders)

    run.total_tenders = total_number_tenders
    run.relevant_tenders = relevant_number_tenders

    db.commit()

    return {
        "publication_date": publication_date,
        "total_number_tenders": total_number_tenders,
        "relevant_number_tenders": relevant_number_tenders,
        "tenders": relevant_tenders,
    }
