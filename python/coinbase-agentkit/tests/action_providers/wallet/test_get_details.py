from decimal import Decimal
from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.wallet.wallet_action_provider import (
    GetWalletDetailsSchema,
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
MOCK_PROVIDER_NAME = "TestWallet"

@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock = Mock(spec=WalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.get_network.return_value = MOCK_NETWORK
    mock.get_balance.return_value = MOCK_BALANCE
    mock.get_name.return_value = MOCK_PROVIDER_NAME
    return mock

@pytest.fixture
def wallet_action_provider(mock_wallet_provider):
    """Create a WalletActionProvider instance with a mock wallet provider."""
    provider = WalletActionProvider()
    provider.wallet_provider = mock_wallet_provider
    return provider

def test_get_wallet_details_schema_valid():
    """Test that GetWalletDetailsSchema accepts valid parameters."""
    schema = GetWalletDetailsSchema()
    assert isinstance(schema, GetWalletDetailsSchema)

def test_get_wallet_details_success(wallet_action_provider):
    """Test successful get wallet details with valid parameters."""
    result = wallet_action_provider.get_wallet_details({})

    expected_response = f"""Wallet Details:
- Provider: {MOCK_PROVIDER_NAME}
- Address: {MOCK_ADDRESS}
- Network:
  * Protocol Family: {MOCK_NETWORK.protocol_family}
  * Network ID: {MOCK_NETWORK.network_id or "N/A"}
  * Chain ID: {str(MOCK_NETWORK.chain_id) if MOCK_NETWORK.chain_id else "N/A"}
- Native Balance: {MOCK_BALANCE}"""

    assert result == expected_response

def test_get_wallet_details_missing_network_ids(wallet_action_provider, mock_wallet_provider):
    """Test handling of missing network IDs."""
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="evm",
        chain_id=None,
        network_id=None
    )

    result = wallet_action_provider.get_wallet_details({})

    assert "Network ID: N/A" in result
    assert "Chain ID: N/A" in result

def test_get_wallet_details_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling in get wallet details."""
    error_message = "Failed to get wallet details"
    mock_wallet_provider.get_balance.side_effect = Exception(error_message)

    result = wallet_action_provider.get_wallet_details({})
    assert result == f"Error getting wallet details: {error_message}"

def test_supports_network(wallet_action_provider):
    """Test that the wallet action provider supports all networks."""
    networks = [
        Network(protocol_family="evm", chain_id=1, network_id="1"),
        Network(protocol_family="solana", chain_id=None, network_id="mainnet"),
        Network(protocol_family="bitcoin", chain_id=None, network_id="mainnet")
    ]

    for network in networks:
        assert wallet_action_provider.supports_network(network) is True

def test_action_provider_setup():
    """Test action provider initialization."""
    provider = WalletActionProvider()
    assert provider.name == "wallet"
    assert provider.action_providers == []
