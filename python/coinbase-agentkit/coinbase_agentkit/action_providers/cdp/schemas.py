"""Schemas for CDP action providers."""

import re

from pydantic import BaseModel, Field, field_validator


class RequestFaucetFundsV2Schema(BaseModel):
    """Input schema for requesting faucet funds."""

    asset_id: str | None = Field(
        None,
        description="The optional asset ID to request from faucet",
    )


class SwapSchema(BaseModel):
    """Input schema for token swapping."""

    from_token: str = Field(..., description="The token contract address to swap from")
    to_token: str = Field(..., description="The token contract address to swap to")
    from_amount: str = Field(
        ...,
        description="The amount of fromToken to sell in whole units (e.g., 1.5 WETH, 10.5 USDC)",
    )
    slippage_bps: int = Field(
        default=100,
        description="The maximum acceptable slippage in basis points (0-10000, default: 100 = 1%)",
        ge=0,
        le=10000,
    )

    @field_validator("from_token", "to_token")
    @classmethod
    def validate_token_address(cls, v: str) -> str:
        """Validate that token address is a valid Ethereum address format."""
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()

    @field_validator("from_amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate that amount is a valid positive number."""
        try:
            amount = float(v)
            if amount <= 0:
                raise ValueError("Amount must be greater than 0")
        except ValueError as e:
            if "could not convert" in str(e):
                raise ValueError("Amount must be a valid number") from e
            raise
        return v
