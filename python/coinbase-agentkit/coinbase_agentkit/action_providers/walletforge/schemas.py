"""Schemas for WalletForge x402 action provider."""

from pydantic import BaseModel, Field


class FetchMarkdownSchema(BaseModel):
    """Input schema for fetching a public URL as markdown."""

    url: str = Field(..., description="Public http(s) URL to fetch as cleaned markdown")
    max_chars: int | None = Field(
        default=None,
        ge=500,
        le=200000,
        description="Optional max markdown characters (500..200000). Server default is 50000.",
    )


class NormalizeTextSchema(BaseModel):
    """Input schema for normalizing text via WalletForge."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=200000,
        description="Text to normalize and extract emails, URLs, and phone numbers from",
    )
