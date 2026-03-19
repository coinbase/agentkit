"""Constants for Sardis action provider."""

SARDIS_API_BASE_URL = "https://api.sardis.sh/api/v2"

SUPPORTED_TOKENS = ["USDC", "USDT", "PYUSD", "EURC"]

SUPPORTED_CHAINS = {
    "base": {"chain_id": "8453", "tokens": ["USDC", "EURC"]},
    "polygon": {"chain_id": "137", "tokens": ["USDC", "USDT", "EURC"]},
    "ethereum": {"chain_id": "1", "tokens": ["USDC", "USDT", "PYUSD", "EURC"]},
    "arbitrum": {"chain_id": "42161", "tokens": ["USDC", "USDT"]},
    "optimism": {"chain_id": "10", "tokens": ["USDC", "USDT"]},
}
