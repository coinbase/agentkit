"""Schemas for the OSF action provider."""

from pydantic import BaseModel, Field


class LookupEntitySchema(BaseModel):
    """Input schema for resolving an entity against authoritative public registries."""

    query: str = Field(
        ...,
        description=(
            "A company or person name, or an identifier (CMS NPI, GLEIF LEI, "
            "FDIC certificate, or SEC EDGAR CIK) to resolve."
        ),
    )


class ScreenEntitySchema(BaseModel):
    """Input schema for sanctions screening of a name."""

    name: str = Field(
        ...,
        description="The name to screen against the OFAC SDN, EU consolidated, and UK OFSI sanctions lists.",
    )


class CheckCveExploitedSchema(BaseModel):
    """Input schema for a CVE exploitation check."""

    cve_id: str = Field(
        ...,
        description="The CVE identifier to check, e.g. CVE-2021-44228.",
    )
