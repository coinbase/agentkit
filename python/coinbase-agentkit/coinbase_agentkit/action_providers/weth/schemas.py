"""Schemas for WETH action provider."""

from pydantic import BaseModel, Field, field_validator


class WrapEthSchema(BaseModel):
    """Input schema for wrapping ETH to WETH."""

    amount_to_wrap: str = Field(
        ..., description="Amount of ETH to wrap in human-readable format (e.g., 0.1 for 0.1 ETH)"
    )

    @field_validator("amount_to_wrap")
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


class UnwrapEthSchema(BaseModel):
    """Input schema for unwrapping WETH to ETH."""

    amount_to_unwrap: str = Field(
        ...,
        description="Amount of WETH to unwrap in human-readable format (e.g., 0.1 for 0.1 WETH)",
    )

    @field_validator("amount_to_unwrap")
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
