"""Test script for the x402search action provider.

This script demonstrates how to use the X402SearchActionProvider with a mock
wallet provider, following the same test patterns used in the repo.

Usage:
    cd python/coinbase-agentkit && pip install -e .
    python ../../test_x402search.py
"""

import json
import sys
from unittest.mock import Mock, patch

# ---------------------------------------------------------------------------
# Mock wallet provider (mimics EvmWalletProvider)
# ---------------------------------------------------------------------------

from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

MOCK_ADDRESS = "0x1234567890123456789012345678901234567890"

mock_wallet = Mock(spec=EvmWalletProvider)
mock_wallet.get_address.return_value = MOCK_ADDRESS
mock_wallet.to_signer.return_value = Mock()  # EthAccountSigner-compatible

# ---------------------------------------------------------------------------
# Import and instantiate the provider
# ---------------------------------------------------------------------------

from coinbase_agentkit.action_providers.x402search import (
    X402SearchActionProvider,
    x402search_action_provider,
)

provider = x402search_action_provider()
print(f"Provider name : {provider.name}")
print(f"Actions       : {[a.name for a in provider._actions]}")
print()

# ---------------------------------------------------------------------------
# Call search_apis with a mocked HTTP response (no real network needed)
# ---------------------------------------------------------------------------

MOCK_SEARCH_RESPONSE = {
    "results": [
        {
            "name": "CoinGecko Price API",
            "description": "Real-time crypto price data for 10,000+ tokens",
            "url": "https://api.coingecko.com/api/v3",
        },
        {
            "name": "CryptoCompare",
            "description": "Comprehensive cryptocurrency market data",
            "url": "https://min-api.cryptocompare.com",
        },
        {
            "name": "Messari",
            "description": "Crypto asset metrics and market data",
            "url": "https://data.messari.io/api/v1",
        },
    ]
}


def make_mock_response(data: dict, status_code: int = 200):
    """Return a requests.Response-like mock."""
    resp = Mock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.raise_for_status = Mock()  # no-op for 200
    return resp


# Patch x402_requests so no real HTTP or payment happens
with patch("coinbase_agentkit.action_providers.x402search.x402search_action_provider.x402_requests") as mock_x402_requests, \
     patch("coinbase_agentkit.action_providers.x402search.x402search_action_provider.x402ClientSync"), \
     patch("coinbase_agentkit.action_providers.x402search.x402search_action_provider.EthAccountSigner"), \
     patch("coinbase_agentkit.action_providers.x402search.x402search_action_provider.register_exact_evm_client"):

    mock_session = Mock()
    mock_session.get.return_value = make_mock_response(MOCK_SEARCH_RESPONSE)
    mock_x402_requests.return_value = mock_session

    result = provider.search_apis(mock_wallet, {"query": "crypto price feed"})

print("search_apis(query='crypto price feed') result:")
print(result)
print()

parsed = json.loads(result)
assert parsed["success"] is True, f"Expected success=True, got: {parsed}"
assert parsed["count"] == 3, f"Expected 3 results, got {parsed['count']}"
assert parsed["results"][0]["name"] == "CoinGecko Price API"

print(f"  success : {parsed['success']}")
print(f"  query   : {parsed['query']}")
print(f"  count   : {parsed['count']}")
for r in parsed["results"]:
    print(f"    - {r['name']}: {r['url']}")

print()
print("All assertions passed.")
