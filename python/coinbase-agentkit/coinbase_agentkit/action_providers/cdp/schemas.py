"""Schemas for CDP action providers."""

from pydantic import BaseModel, Field


class RequestFaucetFundsSchema(BaseModel):
    """Input schema for requesting faucet funds."""

    asset_id: str | None = Field(
        None,
        description="The optional asset ID to request from faucet",
    )


class SwapSchema(BaseModel):
    """Input schema for token swapping."""

    amount: str = Field(description="The amount of the from asset to swap")
    from_asset_id: str = Field(description="The from asset ID to swap")
    to_asset_id: str = Field(description="The to asset ID to receive from the swap")
    network: str = Field(description="The network on which to perform the swap")
