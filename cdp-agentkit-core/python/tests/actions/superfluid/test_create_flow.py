from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.superfluid.constants import CREATE_ABI
from cdp_agentkit_core.actions.superfluid.create_flow import (
    SuperfluidCreateFlowInput,
    superfluid_create_flow,
)

MOCK_RECIPIENT = "0xvalidRecipientAddress"
MOCK_TOKEN_ADDRESS = "0xvalidTokenAddress"
MOCK_FLOW_RATE = "1000000000000000"


def test_create_flow_input_model_valid():
    """Test that CreateFlowInput accepts valid parameters."""
    input_model = SuperfluidCreateFlowInput(
        recipient=MOCK_RECIPIENT,
        token_address=MOCK_TOKEN_ADDRESS,
        flow_rate=MOCK_FLOW_RATE,
    )

    assert input_model.recipient == MOCK_RECIPIENT
    assert input_model.token_address == MOCK_TOKEN_ADDRESS
    assert input_model.flow_rate == MOCK_FLOW_RATE


def test_create_flow_input_model_missing_params():
    """Test that CreateFlowInput raises error when params are missing."""
    with pytest.raises(ValueError):
        SuperfluidCreateFlowInput()


def test_create_flow_success(wallet_factory, contract_invocation_factory):
    """Test successful flow creation with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_invocation = contract_invocation_factory()

    with (
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_invocation
        ) as mock_invoke_contract,
        patch.object(
            mock_contract_invocation, "wait", return_value=mock_contract_invocation
        ) as mock_contract_invocation_wait,
    ):
        action_response = superfluid_create_flow(
            mock_wallet, MOCK_RECIPIENT, MOCK_TOKEN_ADDRESS, MOCK_FLOW_RATE
        )

        expected_response = f"Flow created successfully. Result: {mock_contract_invocation}"
        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address="0xcfA132E353cB4E398080B9700609bb008eceB125",
            abi=CREATE_ABI,
            method="createFlow",
            args={
                "token": MOCK_TOKEN_ADDRESS,
                "sender": mock_wallet.default_address.address_id,
                "receiver": MOCK_RECIPIENT,
                "flowrate": MOCK_FLOW_RATE,
                "userData": "0x",
            },
        )
        mock_contract_invocation_wait.assert_called_once_with()


def test_create_flow_api_error(wallet_factory):
    """Test flow creation when API error occurs."""
    mock_wallet = wallet_factory()

    with patch.object(
        mock_wallet, "invoke_contract", side_effect=Exception("API error")
    ) as mock_invoke_contract:
        action_response = superfluid_create_flow(
            mock_wallet, MOCK_RECIPIENT, MOCK_TOKEN_ADDRESS, MOCK_FLOW_RATE
        )

        expected_response = "Error creating flow: API error"
        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address="0xcfA132E353cB4E398080B9700609bb008eceB125",
            abi=CREATE_ABI,
            method="createFlow",
            args={
                "token": MOCK_TOKEN_ADDRESS,
                "sender": mock_wallet.default_address.address_id,
                "receiver": MOCK_RECIPIENT,
                "flowrate": MOCK_FLOW_RATE,
                "userData": "0x",
            },
        )
