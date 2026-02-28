import requests
from dotenv import load_dotenv
import os
import json
import io
from datetime import date
import PyPDF2
from google import genai

# get all necessary fields (preferably without calling get instance) 
# -> put into df for pandas to filter and find relevant spa keywords and order them 
# -> use ai agent to find top 3 given context 
# -> run automatically with github worker 
# -> store data in postgres + dashboard display (optional)

KEEP_LANGS = ("deu", "eng")
KEEP_LANGS_UPPER = ("DEU", "ENG")

def filter_languages(obj):
    """Keep only deu/eng in locale-keyed dicts; recurse into nested structures."""
    if isinstance(obj, dict):
        keys = list(obj.keys())
        if keys and all(len(k) == 3 and k.isalpha() for k in keys):
            if all(k.islower() for k in keys):
                return {k: obj[k] for k in keys if k in KEEP_LANGS}
            if all(k.isupper() for k in keys):
                return {k: obj[k] for k in keys if k in KEEP_LANGS_UPPER}
        return {k: filter_languages(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [filter_languages(item) for item in obj]
    return obj


def search_all_tenders(publication_date):
    pdf_links = []
    url = "https://api.ted.europa.eu/v3/notices/search"
    body = {
        "query": f"CY=DEU AND publication-date={publication_date} SORT BY publication-number DESC",
        "fields": [                                 # what information we get
            # Buyer Info
            "buyer-name",
            "buyer-identifier",
            "buyer-city",
            "main-activity",
            "buyer-country",
            "buyer-legal-type",
            "corporate-body",
            "organisation-email-buyer",
            "business-email",
        ],
        "limit": 10,
        "page": 1,
        "scope": "ACTIVE"
    }

    headers = {
        'X-API-KEY': os.getenv('EU_TENDER_API_KEY'),
        'Content-Type': "application/json",
        'Accept': "application/json"
    }

    try:
        response = requests.post(url, json=body, headers=headers)
        
        if response.status_code != 200:
            print(f"Status: {response.status_code}")
            print(f"Server Response: {response.text}") 
            return
        
        data = response.json()
        for notice in data.get('notices', []):
            notice = filter_languages(notice)
            pdf = (notice.get('links') or {}).get('pdf') or {}
            url = pdf.get('DEU') or (next(iter(pdf.values()), None) if pdf else None)
            if url:
                pdf_links.append(url)
        return pdf_links
    
    except requests.exceptions.RequestException as e:
        print(f'Request failed: {e}')

def get_pdf_content(link):
    try:
        res = requests.get(link)
        if res.status_code != 200:
            return None
    except requests.exceptions.RequestException as e:
        print(f'Request to pdf failed: {e}')
    return res.content

def convert_pdf_content_to_text(content):
    reader = PyPDF2.PdfReader(io.BytesIO(content))
    text = "".join(reader.pages[i].extract_text() or "" for i in range(len(reader.pages)))
    # print(text)
    return text

def agent_search(input):
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    # If input is a list of tender texts, join with clear separators so the model can tell them apart
    content = input if isinstance(input, str) else "\n\n---\n\n".join(str(t) for t in input)
    res = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=f"Analyze the following tenders and find those relevant to SPA. Return the id and 1 short sentence summary of why it's relevant. The input:\n\n{content}",
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


if __name__ == "__main__":
    load_dotenv()
    today = date.today()
    today_str = f"{today.year}{today.month:02d}{today.day-1:02d}"
    pdf_links = search_all_tenders(today_str)
    agent_input = []
    for link in pdf_links:
        content = get_pdf_content(link)
        text = convert_pdf_content_to_text(content)
        agent_input.append(text)
    agent_search(agent_input)
