from unittest.mock import MagicMock

import pytest

from coinbase_agentkit.action_providers.hyperlane.hyperlane_action_provider import (
    HyperlaneActionProvider,
)
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider


@pytest.fixture
def hyperlane_wallet():
    """Create a mock wallet provider on Base mainnet for testing."""
    mock_wallet = MagicMock(spec=EvmWalletProvider)
    mock_wallet.get_address.return_value = "0x1111111111111111111111111111111111111111"
    mock_wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id="base-mainnet",
        chain_id="8453",
    )
    return mock_wallet


@pytest.fixture
def hyperlane_provider():
    """Create a HyperlaneActionProvider instance for testing."""
    return HyperlaneActionProvider()


@pytest.fixture
def hyperlane_fixtures():
    """Provide common test fixtures."""
    return {
        "warp_route_address": "0x2222222222222222222222222222222222222222",
        "token_address": "0x3333333333333333333333333333333333333333",
        "recipient": "0x4444444444444444444444444444444444444444",
    }
