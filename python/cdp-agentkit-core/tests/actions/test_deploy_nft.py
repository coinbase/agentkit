from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.deploy_nft import (
    DeployNftInput,
    deploy_nft,
)

MOCK_NAME = "Test Token"
MOCK_SYMBOL = "TEST"
MOCK_BASE_URI = "https://www.test.xyz/metadata/"


def test_deploy_nft_input_model_valid():
    """Test that DeployNftInput accepts valid parameters."""
    input_model = DeployNftInput(
        name=MOCK_NAME,
        symbol=MOCK_SYMBOL,
        base_uri=MOCK_BASE_URI,
    )

    assert input_model.name == MOCK_NAME
    assert input_model.symbol == MOCK_SYMBOL
    assert input_model.base_uri == MOCK_BASE_URI


def test_deploy_nft_input_model_missing_params():
    """Test that DeployNftInput raises error when params are missing."""
    with pytest.raises(ValueError):
        DeployNftInput()


def test_deploy_nft_success(wallet_factory, smart_contract_factory):
    """Test successful token deployment with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_instance = smart_contract_factory()

    with (
        patch.object(mock_wallet, "deploy_nft", return_value=mock_contract_instance) as mock_deploy,
        patch.object(
            mock_contract_instance, "wait", return_value=mock_contract_instance
        ) as mock_contract_wait,
    ):
        action_response = deploy_nft(mock_wallet, MOCK_NAME, MOCK_SYMBOL, MOCK_BASE_URI)

        expected_response = f"Deployed NFT Collection {MOCK_NAME} to address {mock_contract_instance.contract_address} on network {mock_wallet.network_id}.\nTransaction hash for the deployment: {mock_contract_instance.transaction.transaction_hash}\nTransaction link for the deployment: {mock_contract_instance.transaction.transaction_link}"
        assert action_response == expected_response
        mock_deploy.assert_called_once_with(
            name=MOCK_NAME,
            symbol=MOCK_SYMBOL,
            base_uri=MOCK_BASE_URI,
        )
        mock_contract_wait.assert_called_once_with()


def test_deploy_nft_api_error(wallet_factory):
    """Test deploy_nft when API error occurs."""
    mock_wallet = wallet_factory()

    with patch.object(mock_wallet, "deploy_nft", side_effect=Exception("API error")) as mock_deploy:
        action_response = deploy_nft(mock_wallet, MOCK_NAME, MOCK_SYMBOL, MOCK_BASE_URI)

        expected_response = "Error deploying NFT API error"
        assert action_response == expected_response
        mock_deploy.assert_called_once_with(
            name=MOCK_NAME,
            symbol=MOCK_SYMBOL,
            base_uri=MOCK_BASE_URI,
        )
