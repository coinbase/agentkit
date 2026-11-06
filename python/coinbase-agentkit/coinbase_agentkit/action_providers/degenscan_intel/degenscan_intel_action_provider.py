"""Degenscan Intel action provider — cross-asset market-event intelligence for agents.

Sources: SEC EDGAR filings, Federal Reserve and other central banks, Federal Register, FTC/DOJ/FDA/CFTC,
USGS earthquakes, NOAA storms, Nasdaq halts, DeFi hacks, Polymarket odds, Hyperliquid perps — normalized into one
event schema and scored into per-asset impacts. Service: https://intel.degenscan.io (Marbella Collins LLC, MIT).
Priced per call ($0.001-$0.10) via x402 (USDC on Base/Solana) or API key; free trial 100 calls/day/IP.
Information and analytics only — not investment advice.
"""

import os
from typing import Any
from urllib.parse import quote

import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import (
    GetAssetBriefSchema,
    GetDeribitPerpsSchema,
    GetMarketEventsSchema,
    GetMarketPulseSchema,
    GetPerpDerivsSchema,
)

BASE_URL = "https://intel.degenscan.io"


class DegenscanIntelActionProvider(ActionProvider[WalletProvider]):
    """Provides actions to read market-event intelligence from Degenscan Intel."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        session: requests.Session | None = None,
    ):
        super().__init__("degenscan_intel", [])
        self.api_key = api_key or os.getenv("DEGENSCAN_INTEL_API_KEY")
        self.base_url = (base_url or BASE_URL).rstrip("/")
        self.session = session or requests.Session()

    def _get(self, path: str, query: dict[str, Any] | None = None) -> str:
        params = {}
        for k, v in (query or {}).items():
            if v is None:
                continue
            params[k] = ",".join(map(str, v)) if isinstance(v, list | tuple) else v
        headers = {"accept": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        else:
            headers["x-free-trial"] = "1"
        res = self.session.get(self.base_url + path, params=params, headers=headers, timeout=20)
        if res.status_code == 402:
            return (
                f"Payment required by {path}: pass api_key (buy one with USDC: POST {self.base_url}/v1/keys/x402/pack_1k) "
                "or use an x402-enabled HTTP client."
            )
        if res.status_code >= 400:
            return f"Error {res.status_code} from Degenscan Intel: {res.text[:300]}"
        return res.text

    @create_action(
        name="get_market_pulse",
        description="""Cheapest probe ($0.001) of what happened in markets in the last hour: event counts by class
(regulatory, corporate, crypto, macro, natural), number of high-severity events and which venues are open
(crypto, US equities). Call it on a timer before deciding whether to fetch full events.""",
        schema=GetMarketPulseSchema,
    )
    def get_market_pulse(self, args: dict[str, Any]) -> str:
        """Fetch the last-hour market pulse."""
        return self._get("/v1/pulse")

    @create_action(
        name="get_market_events",
        description="""Fetch price-moving market events since a time window from ~40 primary sources (SEC EDGAR filings,
Federal Reserve and other central banks, Federal Register rules, FTC/DOJ/FDA/CFTC actions, USGS earthquakes, NOAA storms,
Nasdaq trading halts, DeFi hacks, Polymarket repricing). Each event carries severity, novelty, corroboration count and
impacts[] per asset with direction (-1/0/1), confidence (0..1) and the exposure path (e.g. quake -> TSMC fab -> TSM -> NVDA),
plus tradable_now / next_open. Use it to find catalysts for assets in your book. $0.005 per call.""",
        schema=GetMarketEventsSchema,
    )
    def get_market_events(self, args: dict[str, Any]) -> str:
        """Fetch events with per-asset impacts."""
        a = GetMarketEventsSchema(**args)
        return self._get(
            "/v1/events",
            {
                "since": a.since,
                "universe": a.universe,
                "min_confidence": a.min_confidence,
                "limit": a.limit,
            },
        )

    @create_action(
        name="get_asset_brief",
        description="""One-call pre-trade briefing for one asset (e.g. BTC, ETH, NVDA, MSTR, CL): net event pressure and its
drivers, headlines with sentiment, recent SEC filings (equities), exposure map, related Polymarket markets, upcoming scheduled
catalysts (FOMC, CPI, earnings), perp funding/open-interest flags (crypto) and whether the venue is open now. Use it right
before sizing or explaining a position. $0.10 per call.""",
        schema=GetAssetBriefSchema,
    )
    def get_asset_brief(self, args: dict[str, Any]) -> str:
        """Fetch a pre-trade brief."""
        a = GetAssetBriefSchema(**args)
        return self._get(f"/v1/brief/{quote(a.asset_id.upper(), safe='')}", {"since": a.since})

    @create_action(
        name="get_perp_derivs",
        description="""Perpetual-futures microstructure for one coin from Hyperliquid's public API (no key): hourly funding
with 8h-equivalent and annualized %, predicted next funding by venue (Hyperliquid, Binance, Bybit), open interest in coins
and USD with OI-to-volume, mark/oracle premium, 24h volume and change, and flags such as funding_hot_long, premium_rich,
oi_heavy_vs_volume, joined with primary-source event pressure on the same asset. Use it to avoid crowded funding before
opening a perp. $0.003 per call.""",
        schema=GetPerpDerivsSchema,
    )
    def get_perp_derivs(self, args: dict[str, Any]) -> str:
        """Fetch perp microstructure."""
        a = GetPerpDerivsSchema(**args)
        return self._get(f"/v1/derivs/{quote(a.symbol.upper(), safe='')}")

    @create_action(
        name="get_deribit_perps",
        description="""Funding and positioning for every Deribit perpetual, the venue where Coinbase Advanced / Coinbase for
Agents executes international perps (crypto, stocks, gold, oil): funding 8h and annualized %, mark premium over index (bp),
open interest in USD, 24h volume and the funding gap vs Hyperliquid for the same coin. Pass one symbol to also get 7 days of
hourly funding history. Use it before opening or sizing a perp on Coinbase or comparing venues. $0.002 per call.""",
        schema=GetDeribitPerpsSchema,
    )
    def get_deribit_perps(self, args: dict[str, Any]) -> str:
        """Fetch Deribit perpetuals."""
        a = GetDeribitPerpsSchema(**args)
        return self._get(
            "/v1/deribit/perps", {"symbols": a.symbols, "sort": a.sort, "limit": a.limit}
        )

    def supports_network(self, network: Network) -> bool:
        """Read-only HTTP provider; works on every network."""
        return True


def degenscan_intel_action_provider(
    api_key: str | None = None, base_url: str | None = None
) -> DegenscanIntelActionProvider:
    """Create a new Degenscan Intel action provider."""
    return DegenscanIntelActionProvider(api_key=api_key, base_url=base_url)
