"""Schemas for the x402 Bazaar action provider."""

from pydantic import BaseModel, Field


class TokenVerdictSchema(BaseModel):
    """Input schema for an x402 Bazaar pre-trade token-verdict safety check."""

    address: str = Field(
        ...,
        pattern=r"^0x[a-fA-F0-9]{40}$",
        description="The Base (eip155:8453) ERC-20 token contract address to screen (0x + 40 hex chars).",
    )
    amount_usd: float | None = Field(
        default=None,
        gt=0,
        description="Optional intended trade size in USD; tunes the recommended max safe position size.",
    )
