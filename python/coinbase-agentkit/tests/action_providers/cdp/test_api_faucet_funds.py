"""Tests for CDP API faucet funds action."""

from unittest.mock import Mock, patch

from coinbase_agentkit.action_providers.cdp.cdp_api_action_provider import (
    RequestFaucetFundsSchema,
    cdp_api_action_provider,
)
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_EXPLORER_URL,
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


def test_request_eth_without_asset_id(
    mock_wallet_testnet_provider, mock_transaction, mock_env, mock_cdp_imports
):
    """Test requesting ETH from faucet without specifying asset_id."""
    _, mock_external_address = mock_cdp_imports

    mock_external_address.return_value.faucet.return_value = mock_transaction

    response = cdp_api_action_provider().request_faucet_funds(mock_wallet_testnet_provider, {})

    expected_response = (
        f"Received ETH from the faucet. Transaction: {MOCK_EXPLORER_URL}/{MOCK_TX_HASH}"
    )
    assert response == expected_response


def test_request_eth_with_asset_id(
    mock_wallet_testnet_provider, mock_transaction, mock_env, mock_cdp_imports
):
    """Test requesting ETH from faucet with eth asset_id."""
    _, mock_external_address = mock_cdp_imports

    mock_external_address.return_value.faucet.return_value = mock_transaction

    response = cdp_api_action_provider().request_faucet_funds(
        mock_wallet_testnet_provider, {"asset_id": "eth"}
    )

    expected_response = (
        f"Received eth from the faucet. Transaction: {MOCK_EXPLORER_URL}/{MOCK_TX_HASH}"
    )
    assert response == expected_response


def test_request_usdc(mock_wallet_testnet_provider, mock_transaction, mock_env, mock_cdp_imports):
    """Test requesting USDC from faucet."""
    _, mock_external_address = mock_cdp_imports

    mock_external_address.return_value.faucet.return_value = mock_transaction

    response = cdp_api_action_provider().request_faucet_funds(
        mock_wallet_testnet_provider, {"asset_id": "usdc"}
    )

    expected_response = (
        f"Received usdc from the faucet. Transaction: {MOCK_EXPLORER_URL}/{MOCK_TX_HASH}"
    )
    assert response == expected_response


def test_request_faucet_wrong_network(mock_env):
    """Test faucet request fails on wrong network (mainnet)."""
    with patch("cdp.Cdp"):
        wallet = Mock()
        wallet.get_network.return_value = Network(
            protocol_family="evm",
            network_id=MOCK_MAINNET_NETWORK_ID,
            chain_id=MOCK_MAINNET_CHAIN_ID,
        )

        response = cdp_api_action_provider().request_faucet_funds(wallet, {})
        assert response == "Error: Faucet is only available on base-sepolia network"


def test_request_faucet_api_error(mock_wallet_testnet_provider, mock_env, mock_cdp_imports):
    """Test faucet request when API error occurs."""
    _, mock_external_address = mock_cdp_imports

    mock_external_address.return_value.faucet.side_effect = Exception("Faucet request failed")

    response = cdp_api_action_provider().request_faucet_funds(mock_wallet_testnet_provider, {})

    assert response == "Error requesting faucet funds: Faucet request failed"
