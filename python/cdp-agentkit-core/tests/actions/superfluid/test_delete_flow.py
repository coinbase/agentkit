from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.superfluid.constants import DELETE_ABI
from cdp_agentkit_core.actions.superfluid.delete_flow import (
    SuperfluidDeleteFlowInput,
    superfluid_delete_flow,
)

MOCK_RECIPIENT = "0xvalidRecipientAddress"
MOCK_TOKEN_ADDRESS = "0xvalidTokenAddress"


def test_delete_flow_input_model_valid():
    """Test that DeleteFlowInput accepts valid parameters."""
    input_model = SuperfluidDeleteFlowInput(
        recipient=MOCK_RECIPIENT,
        token_address=MOCK_TOKEN_ADDRESS,
    )

    assert input_model.recipient == MOCK_RECIPIENT
    assert input_model.token_address == MOCK_TOKEN_ADDRESS


def test_delete_flow_input_model_missing_params():
    """Test that DeleteFlowInput raises error when params are missing."""
    with pytest.raises(ValueError):
        SuperfluidDeleteFlowInput()


def test_delete_flow_success(wallet_factory, contract_invocation_factory):
    """Test successful flow deletion with valid parameters."""
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
        action_response = superfluid_delete_flow(mock_wallet, MOCK_RECIPIENT, MOCK_TOKEN_ADDRESS)

        expected_response = f"Flow deleted successfully. Result: {mock_contract_invocation}"
        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address="0xcfA132E353cB4E398080B9700609bb008eceB125",
            abi=DELETE_ABI,
            method="deleteFlow",
            args={
                "token": MOCK_TOKEN_ADDRESS,
                "sender": mock_wallet.default_address.address_id,
                "receiver": MOCK_RECIPIENT,
                "userData": "0x",
            },
        )
        mock_contract_invocation_wait.assert_called_once_with()


def test_delete_flow_api_error(wallet_factory):
    """Test flow deletion when API error occurs."""
    mock_wallet = wallet_factory()

    with patch.object(
        mock_wallet, "invoke_contract", side_effect=Exception("API error")
    ) as mock_invoke_contract:
        action_response = superfluid_delete_flow(mock_wallet, MOCK_RECIPIENT, MOCK_TOKEN_ADDRESS)

        expected_response = "Error deleting flow: API error"
        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address="0xcfA132E353cB4E398080B9700609bb008eceB125",
            abi=DELETE_ABI,
            method="deleteFlow",
            args={
                "token": MOCK_TOKEN_ADDRESS,
                "sender": mock_wallet.default_address.address_id,
                "receiver": MOCK_RECIPIENT,
                "userData": "0x",
            },
        )
