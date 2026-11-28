"""Schemas for the HelmSwap action provider."""

import re

from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError

_ADDRESS = re.compile(r"^0x[a-fA-F0-9]{40}$")


class _SwapBase(BaseModel):
    """Fields shared by the quote and swap schemas."""

    sell_token: str = Field(
        description="The contract address of the token to sell. The native asset is 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    )
    buy_token: str = Field(
        description="The contract address of the token to buy. The native asset is 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    )
    sell_amount: str = Field(
        description="The amount of sell_token to sell in whole units (e.g. 1.5 ETH or 10 USDC)"
    )
    slippage_bps: int | None = Field(
        default=None,
        ge=0,
        le=1000,
        description="Maximum allowed slippage in basis points (default 50, max 1000)",
    )

    @field_validator("sell_token", "buy_token")
    @classmethod
    def validate_address(cls, v: str) -> str:
        """Validate that a token is a 0x-prefixed 20-byte address."""
        if not _ADDRESS.match(v):
            raise PydanticCustomError(
                "address_format", "Token must be a 0x-prefixed 20-byte contract address"
            )
        return v

    @field_validator("sell_amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate that the amount is a positive decimal number."""
        if not re.match(r"^[0-9]*\.?[0-9]+$", v) or float(v) <= 0:
            raise PydanticCustomError("decimal_format", "Amount must be a positive decimal number")
        return v


class GetSwapQuoteSchema(_SwapBase):
    """Input schema for getting a HelmSwap quote."""


class ExecuteSwapSchema(_SwapBase):
    """Input schema for executing a HelmSwap swap."""
