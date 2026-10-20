"""Constants for x402 action provider."""

from typing import TypedDict

# Known facilitator registry
KNOWN_FACILITATORS: dict[str, str] = {
    "cdp": "https://api.cdp.coinbase.com/platform/v2/x402",
    "payai": "https://facilitator.payai.network",
}

DEFAULT_FACILITATOR = "cdp"

# Supported networks for x402 payment protocol
SUPPORTED_NETWORKS = [
    "base-mainnet",
    "base-sepolia",
    "solana-mainnet",
    "solana-devnet",
]

# USDC token addresses for Solana networks
SOLANA_USDC_ADDRESSES: dict[str, str] = {
    "solana-devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "solana-mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
}

# Network mapping from internal network ID to both v1 and v2 (CAIP-2) formats.
# Used for filtering discovery results that may contain either format.
NETWORK_MAPPINGS: dict[str, list[str]] = {
    "base-mainnet": ["base", "eip155:8453"],
    "base-sepolia": ["base-sepolia", "eip155:84532"],
    "solana-mainnet": ["solana", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    "solana-devnet": ["solana-devnet", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"],
}

# x402 protocol version type
X402Version = int  # 1 or 2


class PaymentOption(TypedDict, total=False):
    """Payment option from discovery API (supports both v1 and v2 formats)."""

    scheme: str
    network: str
    asset: str
    # v1 format
    max_amount_required: str
    # v2 format
    amount: str
    price: str
    pay_to: str
    description: str


class DiscoveryResource(TypedDict, total=False):
    """Resource from discovery API."""

    url: str
    resource: str
    type: str
    # v2: the discovery API returns description as a top-level field on the resource.
    description: str
    metadata: dict
    accepts: list[PaymentOption]
    x402_version: int
    last_updated: str


class SimplifiedResource(TypedDict):
    """Simplified resource output for LLM consumption."""

    url: str
    price: str
    description: str
