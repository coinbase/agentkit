"""Schemas for the x402 Bazaar action provider."""

from typing import Literal

from pydantic import BaseModel, Field


class TokenVerdictSchema(BaseModel):
    """Input schema for an x402 Bazaar pre-trade token-verdict safety check."""

    address: str = Field(
        ...,
        pattern=r"^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$",
        description="The token to screen: a Base/Arbitrum 0x… address or a Solana base58 mint.",
    )
    chain: Literal["base", "arbitrum", "solana"] | None = Field(
        default=None,
        description="Which chain the token is on. Default base; a base58 token implies solana.",
    )
    amount_usd: float | None = Field(
        default=None,
        gt=0,
        description="Optional intended trade size in USD; tunes the recommended max safe position size.",
    )
