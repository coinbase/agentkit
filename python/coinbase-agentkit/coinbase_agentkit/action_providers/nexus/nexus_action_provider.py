"""NEXUS Financial Intelligence action provider for AgentKit."""

import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import NEXUS_BASE_URL
from .schemas import ArbSpreadSchema, KalshiConsensusSchema


class NexusActionProvider(ActionProvider[WalletProvider]):
    """Provides live prediction market data via NEXUS Intelligence."""

    def __init__(self):
        super().__init__("nexus", [])

    @create_action(
        name="nexus_kalshi_consensus",
        description=(
            "Get live Kalshi prediction market probability for a market. "
            "Returns probability % and number of contracts. "
            "Markets: Fed, BTC, CPI, GDP. FREE — no payment required."
        ),
        schema=KalshiConsensusSchema,
    )
    def get_kalshi_consensus(self, args: dict) -> str:
        validated = KalshiConsensusSchema(**args)
        market = validated.market
        try:
            r = requests.get(
                f"{NEXUS_BASE_URL}/kalshi",
                params={"market": market},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            markets = data.get("markets") or []
            top = markets[0] if markets else {}
            pct = top.get("probability_pct", "N/A")
            count = data.get("count", len(markets))
            return (
                f"Kalshi {market}: {pct}% probability. {count} contracts. "
                f"Source: Kalshi prediction market."
            )
        except Exception as e:
            return f"NEXUS error: {e}"

    @create_action(
        name="nexus_arb_spread",
        description=(
            "Get live Kalshi vs Polymarket arbitrage spread for prediction markets. "
            "Returns spread in percentage points. "
            "Cost: $0.02 USDC via x402 micropayment on Base mainnet (eip155:8453)."
        ),
        schema=ArbSpreadSchema,
    )
    def get_arb_spread(self, args: dict) -> str:
        validated = ArbSpreadSchema(**args)
        markets = validated.markets
        try:
            r = requests.get(
                f"{NEXUS_BASE_URL}/arb/check",
                params={"markets": markets},
                timeout=10,
            )
            if r.status_code == 402:
                invoice = r.json()
                accept = (invoice.get("accepts") or [{}])[0]
                return (
                    f"Payment required: {accept.get('maxAmountRequired', '20000')} micro-USDC "
                    f"to {accept.get('payTo', '')} on Base mainnet "
                    f"(network {accept.get('network', 'eip155:8453')})."
                )
            r.raise_for_status()
            data = r.json()
            cmp_ = (data.get("comparisons") or [{}])[0]
            spread = cmp_.get("spread", "N/A")
            k = cmp_.get("kalshi_price", "N/A")
            p = cmp_.get("polymarket_price", "N/A")
            return f"Arb spread: {spread}pt. Kalshi: {k}% vs Polymarket: {p}%"
        except Exception as e:
            return f"NEXUS error: {e}"

    def supports_network(self, network: Network) -> bool:
        return True


def nexus_action_provider() -> NexusActionProvider:
    """Create a NEXUS action provider instance."""
    return NexusActionProvider()
