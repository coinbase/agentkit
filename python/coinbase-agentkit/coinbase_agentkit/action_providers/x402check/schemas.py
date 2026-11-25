"""Schemas for x402check action provider."""

from pydantic import BaseModel, Field


class PreflightCheckSchema(BaseModel):
    """Input schema for preflight_check."""

    url: str = Field(
        ...,
        description="Absolute https URL of the x402 seller endpoint to trust-check before paying",
    )
    fresh: bool | None = Field(
        default=None,
        description="When true, force a live probe (skip cache). Defaults to false.",
    )


class VerifyPayToSchema(BaseModel):
    """Input schema for verify_payto."""

    url: str = Field(
        ...,
        description="Absolute https URL of the x402 seller whose live 402 payTo should be verified",
    )
    expected_pay_to: str | None = Field(
        default=None,
        description="Optional allowlisted payTo. When set, a mismatch is flagged in the response.",
    )
    fresh: bool | None = Field(
        default=None,
        description="When true, force a live probe (skip cache). Defaults to false.",
    )
