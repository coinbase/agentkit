from decimal import Decimal
from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.wallet.wallet_action_provider import (
    WalletActionProvider,
)
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import WalletProvider

MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_BALANCE = Decimal("1000000000000000000")  # 1 ETH in wei
MOCK_NETWORK = Network(protocol_family="evm", chain_id="84532", network_id="base-sepolia")
MOCK_PROVIDER_NAME = "TestWallet"


@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock = Mock(spec=WalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.get_balance.return_value = MOCK_BALANCE
    mock.get_network.return_value = MOCK_NETWORK
    mock.get_name.return_value = MOCK_PROVIDER_NAME
    return mock


@pytest.fixture
def wallet_action_provider():
    """Create a WalletActionProvider instance."""
    return WalletActionProvider()
