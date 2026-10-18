"""Input schemas for public company lookups."""

from typing import Literal

from pydantic import BaseModel, Field


class CompanyLookupSchema(BaseModel):
    """Select one company-data lookup and a public company domain."""

    tool: Literal[
        "tech-stack",
        "ats-jobs",
        "company-intent",
        "google-ads",
        "company-profile",
        "company-footprint",
    ] = Field(description="Company data to retrieve from HirePulse.")
    domain: str = Field(
        min_length=3,
        max_length=253,
        pattern=r"^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$",
        description="Public company domain, such as linear.app, without a scheme or path.",
    )


class CompanyScanSchema(BaseModel):
    """Create a free quote for bulk data or hot-buyer screening."""

    operation: Literal["batch", "hot-buyers"] = Field(description="Type of company scan.")
    domains: list[str] = Field(min_length=2, max_length=25, description="Public company domains.")
    tool: Literal["tech-stack", "ats-jobs", "company-intent", "google-ads", "company-profile"] = (
        Field(default="company-intent", description="Lookup to quote when operation is batch.")
    )
    min_intent_score: int = Field(
        default=70, ge=0, le=100, description="Hot-buyer score threshold."
    )
