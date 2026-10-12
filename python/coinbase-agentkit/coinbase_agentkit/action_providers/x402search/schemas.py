"""Schemas for x402search action provider."""

from pydantic import BaseModel, Field


class SearchApisSchema(BaseModel):
    """Input schema for the search_apis action."""

    query: str = Field(
        ...,
        description=(
            "Natural language query to find API services by capability. "
            "Examples: 'token price', 'crypto market data', 'NFT metadata', "
            "'weather forecast', 'sentiment analysis', 'btc price'"
        ),
        min_length=2,
        max_length=200,
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum number of results to return (1-10, default 5).",
    )

    class Config:
        """Pydantic config."""

        title = "Parameters for searching API services by capability"
