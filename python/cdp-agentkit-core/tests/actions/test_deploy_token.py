from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.deploy_token import (
    DeployTokenInput,
    deploy_token,
)

MOCK_NAME = "Test Token"
MOCK_SYMBOL = "TEST"
MOCK_TOTAL_SUPPLY = "1000000"


def test_deploy_token_input_model_valid():
    """Test that DeployTokenInput accepts valid parameters."""
    input_model = DeployTokenInput(
        name=MOCK_NAME,
        symbol=MOCK_SYMBOL,
        total_supply=MOCK_TOTAL_SUPPLY,
    )

    assert input_model.name == MOCK_NAME
    assert input_model.symbol == MOCK_SYMBOL
    assert input_model.total_supply == MOCK_TOTAL_SUPPLY


def test_deploy_token_input_model_missing_params():
    """Test that DeployTokenInput raises error when params are missing."""
    with pytest.raises(ValueError):
        DeployTokenInput()


def test_deploy_token_success(wallet_factory, smart_contract_factory):
    """Test successful token deployment with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_instance = smart_contract_factory()

    with (
        patch.object(
            mock_wallet, "deploy_token", return_value=mock_contract_instance
        ) as mock_deploy,
        patch.object(
            mock_contract_instance, "wait", return_value=mock_contract_instance
        ) as mock_contract_wait,
    ):
        action_response = deploy_token(mock_wallet, MOCK_NAME, MOCK_SYMBOL, MOCK_TOTAL_SUPPLY)

        expected_response = f"Deployed ERC20 token contract {MOCK_NAME} ({MOCK_SYMBOL}) with total supply of {MOCK_TOTAL_SUPPLY} tokens at address {mock_contract_instance.contract_address}. Transaction link: {mock_contract_instance.transaction.transaction_link}"
        assert action_response == expected_response
        mock_deploy.assert_called_once_with(
            name=MOCK_NAME,
            symbol=MOCK_SYMBOL,
            total_supply=MOCK_TOTAL_SUPPLY,
        )
        mock_contract_wait.assert_called_once_with()


def test_deploy_token_api_error(wallet_factory):
    """Test deploy_token when API error occurs."""
    mock_wallet = wallet_factory()

    with patch.object(
        mock_wallet, "deploy_token", side_effect=Exception("API error")
    ) as mock_deploy:
        action_response = deploy_token(mock_wallet, MOCK_NAME, MOCK_SYMBOL, MOCK_TOTAL_SUPPLY)

        expected_response = "Error deploying token API error"

        assert action_response == expected_response
        mock_deploy.assert_called_once_with(
            name=MOCK_NAME,
            symbol=MOCK_SYMBOL,
            total_supply=MOCK_TOTAL_SUPPLY,
        )
