"""Schemas for CDP action providers."""

from pydantic import BaseModel, Field


class RequestFaucetFundsSchema(BaseModel):
    """Input schema for requesting faucet funds."""

    asset_id: str | None = Field(
        None,
        description="The optional asset ID to request from faucet",
    )
