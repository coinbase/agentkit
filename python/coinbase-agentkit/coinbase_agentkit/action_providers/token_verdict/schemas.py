"""Schemas for Token Verdict action provider."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")


class TokenVerdictSchema(BaseModel):
    """Input schema for getting a token risk verdict.

    Mirrors the Token Verdict service's request contract for
    POST /v1/verdict: a token contract address plus which chain's
    market to analyze.
    """

    model_config = ConfigDict(extra="forbid")

    address: str = Field(
        ...,
        description=(
            "The token contract address to get a verdict for " "(0x-prefixed, 40 hex characters)."
        ),
    )
    chain: Literal["base", "ethereum", "solana"] = Field(
        default="base",
        description=(
            'Which chain\'s token market to analyze: "base" (default), '
            '"ethereum", or "solana". Payment always settles in USDC on Base.'
        ),
    )

    @field_validator("address")
    @classmethod
    def validate_address(cls, value: str) -> str:
        """Validate the token contract address format.

        Args:
            value: The address to validate.

        Returns:
            The validated address.

        Raises:
            ValueError: If the address is not a 0x-prefixed 40-hex-character address.

        """
        if not ADDRESS_PATTERN.match(value):
            raise ValueError("address must be a 0x token contract address")
        return value
