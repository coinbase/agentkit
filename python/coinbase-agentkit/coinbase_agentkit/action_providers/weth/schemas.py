"""Schemas for WETH action provider."""

from pydantic import BaseModel, Field, field_validator

from .constants import MIN_WRAP_AMOUNT
from .validators import eth_amount_validator

# Calculate the minimum amount in ETH (or WETH) as a float.
MINIMUM_AMOUNT = MIN_WRAP_AMOUNT / 10**18


class WrapEthInput(BaseModel):
    """Input argument schema for wrapping ETH to WETH."""

    amount_to_wrap: str = Field(
        ...,
        description="Amount of ETH to wrap as whole amounts (e.g., 1.5 for 1.5 ETH)",
    )

    @field_validator("amount_to_wrap")
    @classmethod
    def validate_eth_amount(cls, v: str) -> str:
        """Validate ETH amount."""
        return eth_amount_validator(v)


class UnwrapWethInput(BaseModel):
    """Input argument schema for unwrapping WETH back to ETH."""

    amount_to_unwrap: str = Field(
        ...,
        description="Amount of WETH to unwrap as whole amounts (e.g., 1.5 for 1.5 WETH)",
    )

    @field_validator("amount_to_unwrap")
    @classmethod
    def validate_eth_amount(cls, v: str) -> str:
        """Validate ETH amount."""
        return eth_amount_validator(v)
