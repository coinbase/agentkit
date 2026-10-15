"""Test fixtures for WalletForge action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.walletforge.constants import (
    AMOUNT_NORMALIZE,
    DEFAULT_ASSET,
    DEFAULT_NETWORK,
    DEFAULT_PAY_TO,
)
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

MOCK_ADDRESS = "0x1111111111111111111111111111111111111111"
# Dummy key for local signing in unit tests only. Never a funded account.
MOCK_PRIVATE_KEY = "0x" + "11" * 32


def payment_required(
    *,
    amount: str = AMOUNT_NORMALIZE,
    resource_url: str = "https://api.walletforge.app/v1/normalize",
    with_bazaar: bool = True,
) -> dict:
    """Build a v2 PAYMENT-REQUIRED envelope for mocks."""
    body = {
        "x402Version": 2,
        "error": "PAYMENT-SIGNATURE header is required",
        "resource": {
            "url": resource_url,
            "description": "WalletForge tool",
            "mimeType": "application/json",
        },
        "accepts": [
            {
                "scheme": "exact",
                "network": DEFAULT_NETWORK,
                "amount": amount,
                "asset": DEFAULT_ASSET,
                "payTo": DEFAULT_PAY_TO,
                "maxTimeoutSeconds": 60,
                "extra": {"name": "USD Coin", "version": "2"},
            }
        ],
        "extensions": {},
    }
    if with_bazaar:
        body["extensions"] = {
            "bazaar": {
                "info": {
                    "serviceName": "WalletForge",
                    "tags": ["web-scraping", "markdown"],
                }
            }
        }
    return body


@pytest.fixture
def mock_wallet():
    """Create a mock EVM wallet provider."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.sign_typed_data.return_value = "0x" + "ab" * 65
    mock.get_network.return_value = Mock(
        protocol_family="evm", network_id="base-mainnet", chain_id="8453"
    )
    return mock
