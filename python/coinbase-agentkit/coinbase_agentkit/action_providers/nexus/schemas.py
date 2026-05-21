"""Schemas for NEXUS action provider."""

from pydantic import BaseModel, Field


class KalshiConsensusSchema(BaseModel):
    """Input schema for Kalshi consensus lookup."""

    market: str = Field(default="Fed", description="Market: Fed, Bitcoin, CPI, GDP")


class ArbSpreadSchema(BaseModel):
    """Input schema for cross-venue arb spread."""

    markets: str = Field(
        default="Fed,BTC",
        description="Comma-separated markets e.g. Fed,BTC",
    )
