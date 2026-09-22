"""Common test fixtures for Nano Wallet Provider tests."""

from decimal import Decimal
from unittest.mock import Mock

import pytest

from coinbase_agentkit.wallet_providers.nano_wallet_provider import (
    NanoWalletProvider,
    NanoWalletProviderConfig,
)

# =========================================================
# test constants
# =========================================================

MOCK_ADDRESS = "nano_1q7x4j5x8g1y6kq3m2n9z0f4d8s7a2c6b5e3h1j0k9l8m7n6o5p4q3r2s1t0u"
MOCK_RPC_URL = "https://mock.nano.rpc"
MOCK_NETWORK_ID = "nano:mainnet"
MOCK_BALANCE_XNO = Decimal("12.5")
MOCK_TX_HASH = "ABCDEF01"
MOCK_TO = "nano_3r4e2w1q9o8p7i6u5y4t3r2e1w0q9z8x7c6v5b4n3m2l1k0j9h8g7f6d5s4a"

FAKE_RESULT_BALANCE = str(int(MOCK_BALANCE_XNO * (10**30)))


@pytest.fixture
def wallet_provider():
    """Create a NanoWalletProvider instance with a mocked RPC."""
    config = NanoWalletProviderConfig(address=MOCK_ADDRESS, rpc_url=MOCK_RPC_URL)
    provider = NanoWalletProvider(config)
    provider._rpc = Mock()
    return provider
