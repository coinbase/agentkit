"""Schemas for DefiLlama action provider."""

from pydantic import BaseModel, Field


class SearchProtocolsSchema(BaseModel):
    """Input schema for searching protocols on DefiLlama."""

    query: str = Field(..., description="Search query string to match against protocol names")


class GetProtocolSchema(BaseModel):
    """Input schema for getting detailed information about a specific protocol."""

    protocol_id: str = Field(
        ...,
        description="The protocol identifier from DefiLlama (e.g. uniswap, aave, aerodrome)",
    )


class GetTokenPricesSchema(BaseModel):
    """Input schema for getting token prices from DefiLlama."""

    tokens: list[str] = Field(
        ...,
        description="List of token addresses with chain prefix (e.g., ['ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'])",
    )
    search_width: str | None = Field(
        default=None,
        description="Optional time range to search for prices (e.g. '4h'). Leave None if unspecified.",
    )
