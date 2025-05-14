"""Tests for CDP API faucet funds action."""

from unittest.mock import AsyncMock, Mock, patch

from coinbase_agentkit.action_providers.cdp.cdp_api_action_provider import (
    RequestFaucetFundsSchema,
    cdp_api_action_provider,
)
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_MAINNET_CHAIN_ID,
    MOCK_MAINNET_NETWORK_ID,
    MOCK_TX_HASH,
)


def test_request_faucet_funds_input_with_asset_id():
    """Test that RequestFaucetFundsInput accepts asset_id parameter."""
    input_model = RequestFaucetFundsSchema(asset_id="eth")
    assert input_model.asset_id == "eth"


def test_request_faucet_funds_input_without_asset_id():
    """Test that RequestFaucetFundsInput works without asset_id parameter."""
    input_model = RequestFaucetFundsSchema()
    assert input_model.asset_id is None


def test_request_eth_without_asset_id(mock_wallet_testnet_provider, mock_transaction, mock_env):
    """Test requesting ETH from faucet without specifying asset_id."""
    # Create a mock CDP client
    mock_client = Mock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.evm = Mock()
    mock_client.evm.request_faucet = AsyncMock(return_value=MOCK_TX_HASH)

    # Ensure the wallet provider's get_client method returns our mock
    mock_wallet_testnet_provider.get_client.return_value = mock_client

    # Setup mock loop
    mock_loop = Mock()
    mock_loop.run_until_complete.return_value = MOCK_TX_HASH

    with patch("asyncio.get_event_loop", return_value=mock_loop):
        response = cdp_api_action_provider().request_faucet_funds(mock_wallet_testnet_provider, {})

        assert "Received ETH from the faucet" in response
        assert MOCK_TX_HASH in response


def test_request_eth_with_asset_id(mock_wallet_testnet_provider, mock_transaction, mock_env):
    """Test requesting ETH from faucet with eth asset_id."""
    # Create a mock CDP client
    mock_client = Mock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.evm = Mock()
    mock_client.evm.request_faucet = AsyncMock(return_value=MOCK_TX_HASH)

    # Ensure the wallet provider's get_client method returns our mock
    mock_wallet_testnet_provider.get_client.return_value = mock_client

    # Setup mock loop
    mock_loop = Mock()
    mock_loop.run_until_complete.return_value = MOCK_TX_HASH

    with patch("asyncio.get_event_loop", return_value=mock_loop):
        response = cdp_api_action_provider().request_faucet_funds(
            mock_wallet_testnet_provider, {"asset_id": "eth"}
        )

        assert "Received eth from the faucet" in response
        assert MOCK_TX_HASH in response


def test_request_usdc(mock_wallet_testnet_provider, mock_transaction, mock_env):
    """Test requesting USDC from faucet."""
    # Create a mock CDP client
    mock_client = Mock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.evm = Mock()
    mock_client.evm.request_faucet = AsyncMock(return_value=MOCK_TX_HASH)

    # Ensure the wallet provider's get_client method returns our mock
    mock_wallet_testnet_provider.get_client.return_value = mock_client

    # Setup mock loop
    mock_loop = Mock()
    mock_loop.run_until_complete.return_value = MOCK_TX_HASH

    with patch("asyncio.get_event_loop", return_value=mock_loop):
        response = cdp_api_action_provider().request_faucet_funds(
            mock_wallet_testnet_provider, {"asset_id": "usdc"}
        )

        assert "Received usdc from the faucet" in response
        assert MOCK_TX_HASH in response


def test_request_faucet_wrong_network(mock_env):
    """Test faucet request fails on wrong network (mainnet)."""
    wallet = Mock()
    wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id=MOCK_MAINNET_NETWORK_ID,
        chain_id=MOCK_MAINNET_CHAIN_ID,
    )

    response = cdp_api_action_provider().request_faucet_funds(wallet, {})
    assert "Error: Faucet is only supported on" in response
