import requests
from dotenv import load_dotenv
import os
import json
import io
from datetime import date
import PyPDF2
from google import genai
from fastapi import FastAPI
from pydantic import BaseModel
import logging

load_dotenv()

logging.basicConfig(
    level = logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

logger = logging.getLogger(__name__)

def search_all_tenders(publication_date):
    pdf_links = []
    url = "https://api.ted.europa.eu/v3/notices/search"
    body = {
        "query": f"classification-cpv=48000000 AND submission-language IN (ENG DEU) AND buyer-country IN (AUT DEU CHE) AND publication-date=20260227",
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
            return

        data = response.json()
        for notice in data.get("notices", []):
            pdf = (notice.get("links") or {}).get("pdf") or {}
            url = pdf.get("DEU") or pdf.get("ENG")
            if url:
                pdf_links.append(url)
        return pdf_links

    except requests.exceptions.RequestException as e:
        logger.error("Tender API request failed: %s", e)


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
        If a match is found, provide a 1-sentence justification. If no match is found, state: "No Match - Insufficient Data."
        """
    content = (
        input if isinstance(input, str) else "\n\n---\n\n".join(str(t) for t in input)
    )
    res = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=f"{agent_context}. These are the tenders: {content}",
    )
    text = getattr(res, "text", None) or ""
    results_path = "results.json"
    if os.path.exists(results_path):
        with open(results_path, "r", encoding="utf-8") as f:
            results = json.load(f)
    else:
        results = []
    results.append({"response": text, "timestamp": date.today().isoformat()})
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    return text

app = FastAPI()

@app.get("/health")
def read_root():
    return {"message" : "Server is healthy"}

@app.get("/tenders/run")
def run_pipeline():
    today = date.today()
    today_str = f"{today.year}{today.month:02d}{today.day-1:02d}"

    pdf_links = search_all_tenders(today_str)
    agent_input = []
    for link in pdf_links:
        content = get_pdf_content(link)
        if not content:
            continue
        text = convert_pdf_content_to_text(content)

        agent_input.append(text)
    if not agent_input:
        return {"error": "No PDF content extracted"}
    ai_result = agent_search(agent_input)

    return {
        "publication_date": today_str,
        "pdf_links": pdf_links,
        "analysis": ai_result,
    }
