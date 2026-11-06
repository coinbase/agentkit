"""Schemas for Degenscan Intel action provider."""

from typing import Literal

from pydantic import BaseModel, Field


class GetMarketPulseSchema(BaseModel):
    """No inputs — cheapest probe of what happened in the last hour."""


class GetMarketEventsSchema(BaseModel):
    """Input schema for fetching price-moving market events with per-asset impacts."""

    since: str = Field(
        "4h", description='Lookback window, e.g. "1h", "4h", "24h" or an ISO timestamp'
    )
    universe: list[str] | None = Field(
        None,
        description="Asset ids to filter on, e.g. ['BTC','ETH','NVDA','CL']. Omit for all covered assets.",
    )
    min_confidence: float = Field(0.4, ge=0, le=1, description="Minimum impact confidence (0..1)")
    limit: int = Field(30, ge=1, le=200)


class GetAssetBriefSchema(BaseModel):
    """Input schema for a one-call pre-trade brief for one asset."""

    asset_id: str = Field(..., description="Asset id, e.g. BTC, ETH, NVDA, MSTR, CL, GC")
    since: str = Field("24h", description="Lookback for events")


class GetDeribitPerpsSchema(BaseModel):
    """Input schema for Deribit perpetuals (venue for Coinbase Advanced international perps)."""

    symbols: list[str] | None = Field(
        None,
        description="Coins, e.g. ['BTC','SOL','NVDA']; one symbol adds 7 days of hourly funding history",
    )
    sort: Literal["volume", "oi", "funding", "neg_funding", "abs_funding", "gap"] = Field(
        "volume", description="Sort order; 'gap' = largest funding gap vs Hyperliquid"
    )
    limit: int = Field(25, ge=1, le=150)


class GetPerpDerivsSchema(BaseModel):
    """Input schema for perp funding / open interest / premium for one coin."""

    symbol: str = Field(
        ..., description="Perp coin as listed on Hyperliquid, e.g. BTC, ETH, SOL, HYPE"
    )
