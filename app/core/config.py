import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./tenders.db"
EU_TENDER_API_KEY = os.getenv("EU_TENDER_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_AGENT_MODEL = os.getenv("GEMINI_AGENT_MODEL") or "gemini-2.5-flash-lite"

DEFAULT_TED_FIELDS = [
    "publication-number",
    "links",
    "BT-137-Lot",
    "BT-21-Lot",
    "BT-24-Lot",
    "BT-22-Lot",
]

ALLOWED_SUBMISSION_LANGUAGES = {"ENG", "DEU", "FRA", "ITA", "ESP", "NLD", "POL", "ELL"}
DEFAULT_SUBMISSION_LANGUAGES = ["ENG", "DEU"]

ALLOWED_BUYER_COUNTRIES = {"AUT", "DEU", "CHE", "FRA", "ITA", "ESP", "NLD", "POL", "BEL", "HRV"}
DEFAULT_BUYER_COUNTRIES = ["AUT", "DEU", "CHE"]

ALLOWED_NOTICE_TYPES = {
    "qu-sy",
    "pmc",
    "pin-tran",
    "pin-cfc-social",
    "pin-cfc-standard",
    "pin-only",
    "pin-rtl",
    "subco",
    "veat",
}

TED_API_URL = "https://api.ted.europa.eu/v3/notices/search"
