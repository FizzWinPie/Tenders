from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.core.config import (
    ALLOWED_BUYER_COUNTRIES,
    ALLOWED_NOTICE_TYPES,
    ALLOWED_SUBMISSION_LANGUAGES,
)


class TenderSearchRequest(BaseModel):
    """User inputs for tender search. All filters are optional with defaults."""

    date_mode: Literal["exact", "range"] = Field(
        default="exact",
        description="Use a single publication date ('exact') or a date range ('range').",
    )
    input_date: str | None = Field(
        default=None,
        description="Publication date YYYYMMDD (used when date_mode='exact'). Defaults to today.",
        examples=["20260302"],
    )
    date_from: str | None = Field(
        default=None,
        description="Start of range YYYYMMDD (required when date_mode='range').",
        examples=["20260301"],
    )
    date_to: str | None = Field(
        default=None,
        description="End of range YYYYMMDD (required when date_mode='range').",
        examples=["20260302"],
    )
    keyword: str | None = Field(
        default=None,
        description="Full-text search term (e.g. SAP). Optional.",
        min_length=1,
        examples=["SAP"],
    )
    submission_languages: list[str] | None = Field(
        default=None,
        description="Submission languages (3-letter codes, e.g. ENG, DEU). Uses allowlist. Default: ENG, DEU.",
        examples=[["ENG", "DEU"]],
    )
    buyer_countries: list[str] | None = Field(
        default=["DEU"],
        description="Buyer countries (3-letter codes, e.g. AUT, DEU, CHE). Uses allowlist. Default: AUT, DEU, CHE.",
        examples=[["AUT", "DEU", "CHE"]],
    )
    notice_types: list[str] | None = Field(
        default=None,
        description="Notice type(s) (BT-02). e.g. qu-sy, pmc, pin-tran, pin-cfc-social, pin-cfc-standard, pin-only, pin-rtl, subco, veat. Uses allowlist.",
        examples=[["pin-cfc-standard", "pin-only"]],
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=250,
        description="Number of results per page (TED API max 250).",
    )
    page: int = Field(
        default=1,
        ge=1,
        description="Page number (1-based).",
    )

    @model_validator(mode="after")
    def check_range_dates(self):
        if self.date_mode == "range" and (not self.date_from or not self.date_to):
            raise ValueError("date_from and date_to are required when date_mode='range'")
        return self

    @model_validator(mode="after")
    def check_languages_countries(self):
        if self.submission_languages is not None:
            if not self.submission_languages:
                raise ValueError("submission_languages must not be empty when provided")
            invalid = {s.upper() for s in self.submission_languages} - ALLOWED_SUBMISSION_LANGUAGES
            if invalid:
                raise ValueError(
                    f"submission_languages must be from {sorted(ALLOWED_SUBMISSION_LANGUAGES)}, got {invalid}"
                )
        if self.buyer_countries is not None:
            if not self.buyer_countries:
                raise ValueError("buyer_countries must not be empty when provided")
            invalid = {c.upper() for c in self.buyer_countries} - ALLOWED_BUYER_COUNTRIES
            if invalid:
                raise ValueError(
                    f"buyer_countries must be from {sorted(ALLOWED_BUYER_COUNTRIES)}, got {invalid}"
                )
        if self.notice_types is not None:
            if not self.notice_types:
                raise ValueError("notice_types must not be empty when provided")
            invalid = {t.lower().strip() for t in self.notice_types} - ALLOWED_NOTICE_TYPES
            if invalid:
                raise ValueError(
                    f"notice_types must be from {sorted(ALLOWED_NOTICE_TYPES)}, got {invalid}"
                )
        return self


class TenderPickRequest(BaseModel):
    """Request body for LLM-based tender winner selection."""

    tenders: list[dict[str, Any]] = Field(
        ...,
        description="Shortlisted tender objects (typically the 5 most relevant ones).",
        examples=[
            [
                {
                    "id": 123,
                    "lot_title": {"ENG": "SAP support services"},
                    "lot_description": {"ENG": "Long-term SAP application management"},
                    "deadline": "20260331",
                }
            ]
        ],
    )
    runs: int = Field(
        default=3,
        ge=1,
        le=10,
        description="How many distinct winners to pick (LLM is called once per winner).",
    )
    company_information_data: str | None = Field(
        default=None,
        description="Optional free-text description of the company to guide selection.",
    )
    user_specific_guidelines: str | None = Field(
        default=None,
        description="Optional free-text user preferences or additional constraints.",
    )


class TenderWinner(BaseModel):
    """Single LLM-selected tender winner with explanation."""

    rank: int = Field(
        ...,
        description="1-based rank of this winner (1 = first pick).",
        ge=1,
    )
    tender: dict[str, Any] = Field(
        ...,
        description="Original tender object as provided in the request.",
    )
    reason: str = Field(
        ...,
        description="Short explanation why this tender was selected.",
    )


class KeywordsFromUrlRequest(BaseModel):
    """Request body for extracting keywords from a company website URL."""

    url: str = Field(
        ...,
        description="Company website URL to scrape and analyze for keywords.",
        min_length=1,
        examples=["https://example.com/about"],
    )
