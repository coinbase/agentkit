"""Schemas for Pyth action provider."""

from pydantic import BaseModel, Field


class FetchPriceFeedSchema(BaseModel):
    """Input schema for fetching Pyth price feed ID."""

    token_symbol: str = Field(
        ..., description="The asset ticker/symbol to fetch the price feed ID for"
    )
    quote_currency: str = Field(
        default="USD", description="The quote currency to filter by (defaults to USD)"
    )
    asset_type: str = Field(
        default="crypto", description="The asset type to search for (crypto, equity, fx, metal)"
    )


class FetchPriceSchema(BaseModel):
    """Input schema for fetching Pyth price."""

    price_feed_id: str = Field(..., description="The price feed ID to fetch the price for")
