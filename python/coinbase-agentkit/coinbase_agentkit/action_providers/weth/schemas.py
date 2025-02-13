"""Schemas for WETH action provider."""

import re

from pydantic import BaseModel, Field, validator

from .constants import MIN_WRAP_AMOUNT


class WrapEthSchema(BaseModel):
    """Input schema for wrapping ETH to WETH."""

    amount_to_wrap: str = Field(..., description="Amount of ETH to wrap in wei")

    @validator("amount_to_wrap")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate that amount is a valid wei value (whole number as string)."""
        if not re.match(r"^[0-9]+$", v):
            raise ValueError("Amount must be a whole number as a string")

        if int(v) < MIN_WRAP_AMOUNT:
            raise ValueError(f"Amount must be at least {MIN_WRAP_AMOUNT} wei (0.0001 WETH)")

        return v
