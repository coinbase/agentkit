from decimal import Decimal
from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.wallet.wallet_action_provider import (
    GetBalanceSchema,
    WalletActionProvider,
)
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import WalletProvider

MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_BALANCE = Decimal("1000000000000000000")  # 1 ETH in wei
MOCK_NETWORK = Network(
    protocol_family="evm",
    chain_id=1,
    network_id="base-sepolia"
)

@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock = Mock(spec=WalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.get_balance.return_value = MOCK_BALANCE
    mock.get_network.return_value = MOCK_NETWORK
    return mock

@pytest.fixture
def wallet_action_provider(mock_wallet_provider):
    """Create a WalletActionProvider instance with a mock wallet provider."""
    provider = WalletActionProvider()
    provider.wallet_provider = mock_wallet_provider
    return provider

def test_get_balance_schema_valid():
    """Test that GetBalanceSchema is valid with no parameters."""
    schema = GetBalanceSchema()
    assert isinstance(schema, GetBalanceSchema)

def test_get_balance_success(wallet_action_provider):
    """Test successful get balance."""
    result = wallet_action_provider.get_balance({})
    expected = f"Native balance at address {MOCK_ADDRESS}: {MOCK_BALANCE}"
    assert result == expected

def test_get_balance_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling in get balance."""
    error_message = "Failed to get balance"
    mock_wallet_provider.get_balance.side_effect = Exception(error_message)

    result = wallet_action_provider.get_balance({})
    assert result == f"Error getting balance: {error_message}"
