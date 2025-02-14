"""Fixtures for WETH action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.weth.weth_action_provider import WethActionProvider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider

MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_TX_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
MOCK_RECEIPT = {"status": 1, "transactionHash": MOCK_TX_HASH}
MOCK_NETWORK = Network(protocol_family="evm", chain_id="84532", network_id="base-sepolia")


@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.get_network.return_value = MOCK_NETWORK
    mock.send_transaction.return_value = MOCK_TX_HASH
    return mock


@pytest.fixture
def weth_action_provider(mock_wallet_provider):
    """Create a WethActionProvider instance with a mock wallet provider."""
    provider = WethActionProvider()
    provider.wallet_provider = mock_wallet_provider
    return provider
