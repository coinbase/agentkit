from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.deploy_contract import (
    DeployContractInput,
    deploy_contract,
)

MOCK_SOLIDITY_VERSION = "0.8.0"
MOCK_SOLIDITY_INPUT_JSON = "{}"
MOCK_CONTRACT_NAME = "TestContract"
MOCK_CONSTRUCTOR_ARGS = {"arg1": "value1", "arg2": "value2"}


def test_deploy_contract_input_model_valid():
    """Test that DeployContractInput accepts valid parameters."""
    input_model = DeployContractInput(
        solidity_version=MOCK_SOLIDITY_VERSION,
        solidity_input_json=MOCK_SOLIDITY_INPUT_JSON,
        contract_name=MOCK_CONTRACT_NAME,
        constructor_args=MOCK_CONSTRUCTOR_ARGS,
    )

    assert input_model.solidity_version == MOCK_SOLIDITY_VERSION
    assert input_model.solidity_input_json == MOCK_SOLIDITY_INPUT_JSON
    assert input_model.contract_name == MOCK_CONTRACT_NAME
    assert input_model.constructor_args == MOCK_CONSTRUCTOR_ARGS


def test_deploy_contract_input_model_missing_params():
    """Test that DeployContractInput raises error when params are missing."""
    with pytest.raises(ValueError):
        DeployContractInput()


def test_deploy_contract_success(wallet_factory, smart_contract_factory):
    """Test successful contract deployment with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_instance = smart_contract_factory()

    with (
        patch.object(
            mock_wallet, "deploy_contract", return_value=mock_contract_instance
        ) as mock_deploy,
        patch.object(
            mock_contract_instance, "wait", return_value=mock_contract_instance
        ) as mock_contract_wait,
    ):
        action_response = deploy_contract(
            mock_wallet,
            MOCK_SOLIDITY_VERSION,
            MOCK_SOLIDITY_INPUT_JSON,
            MOCK_CONTRACT_NAME,
            MOCK_CONSTRUCTOR_ARGS,
        )

        expected_response = f"Deployed contract {MOCK_CONTRACT_NAME} at address {mock_contract_instance.contract_address}. Transaction link: {mock_contract_instance.transaction.transaction_link}"
        assert action_response == expected_response
        mock_deploy.assert_called_once_with(
            solidity_version="0.8.0+commit.c7dfd78e",
            solidity_input_json=MOCK_SOLIDITY_INPUT_JSON,
            contract_name=MOCK_CONTRACT_NAME,
            constructor_args=MOCK_CONSTRUCTOR_ARGS,
        )
        mock_contract_wait.assert_called_once_with()


def test_deploy_contract_api_error(wallet_factory):
    """Test deploy_contract when API error occurs."""
    mock_wallet = wallet_factory()

    with patch.object(
        mock_wallet, "deploy_contract", side_effect=Exception("API error")
    ) as mock_deploy:
        action_response = deploy_contract(
            mock_wallet,
            MOCK_SOLIDITY_VERSION,
            MOCK_SOLIDITY_INPUT_JSON,
            MOCK_CONTRACT_NAME,
            MOCK_CONSTRUCTOR_ARGS,
        )

        expected_response = "Error deploying contract: API error"

        assert action_response == expected_response
        mock_deploy.assert_called_once_with(
            solidity_version="0.8.0+commit.c7dfd78e",
            solidity_input_json=MOCK_SOLIDITY_INPUT_JSON,
            contract_name=MOCK_CONTRACT_NAME,
            constructor_args=MOCK_CONSTRUCTOR_ARGS,
        )
