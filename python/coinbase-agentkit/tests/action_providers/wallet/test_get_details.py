from coinbase_agentkit.action_providers.wallet.schemas import GetWalletDetailsSchema
from coinbase_agentkit.action_providers.wallet.wallet_action_provider import WalletActionProvider
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_ADDRESS,
    MOCK_BALANCE,
    MOCK_NETWORK,
    MOCK_PROVIDER_NAME,
)


def test_get_wallet_details_schema_valid():
    """Test that GetWalletDetailsSchema accepts valid parameters."""
    schema = GetWalletDetailsSchema()
    assert isinstance(schema, GetWalletDetailsSchema)


def test_get_wallet_details_success(wallet_action_provider, mock_wallet_provider):
    """Test successful get wallet details with valid parameters."""
    result = wallet_action_provider.get_wallet_details(
        mock_wallet_provider, GetWalletDetailsSchema()
    )

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
        protocol_family="evm", chain_id=None, network_id=None
    )

    result = wallet_action_provider.get_wallet_details(
        mock_wallet_provider, GetWalletDetailsSchema()
    )

    assert "Network ID: N/A" in result
    assert "Chain ID: N/A" in result


def test_get_wallet_details_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling in get wallet details."""
    error_message = "Failed to get wallet details"
    mock_wallet_provider.get_balance.side_effect = Exception(error_message)

    result = wallet_action_provider.get_wallet_details(
        mock_wallet_provider, GetWalletDetailsSchema()
    )
    assert result == f"Error getting wallet details: {error_message}"


def test_supports_network(wallet_action_provider):
    """Test that the wallet action provider supports all networks."""
    networks = [
        Network(protocol_family="evm", chain_id="1", network_id="1"),
        Network(protocol_family="solana", chain_id=None, network_id="mainnet"),
        Network(protocol_family="bitcoin", chain_id=None, network_id="mainnet"),
    ]

    for network in networks:
        assert wallet_action_provider.supports_network(network) is True


def test_action_provider_setup():
    """Test action provider initialization."""
    provider = WalletActionProvider()
    assert provider.name == "wallet"
    assert provider.action_providers == []
