import logging

from fastapi import FastAPI

from app.api import health_router, tenders_router
from app.core.logging_config import setup_logging

setup_logging(level=logging.INFO)

app = FastAPI()
app.include_router(health_router)
app.include_router(tenders_router)
