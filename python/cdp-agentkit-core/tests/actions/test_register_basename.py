from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.register_basename import (
    RegisterBasenameInput,
    register_basename,
)

MOCK_NETWORK_ID = "base-mainnet"
MOCK_BASENAME = "example.base.eth"
MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_AMOUNT = 0.002


def test_register_basename_input_model_valid():
    """Test that RegisterBasenameInput accepts valid parameters."""
    input_model = RegisterBasenameInput(
        basename=MOCK_BASENAME,
        amount=str(MOCK_AMOUNT),
    )

    assert input_model.basename == MOCK_BASENAME
    assert input_model.amount == str(MOCK_AMOUNT)


def test_register_basename_input_model_missing_params():
    """Test that RegisterBasenameInput raises error when params are missing."""
    with pytest.raises(ValueError):
        RegisterBasenameInput()


def test_register_basename_success(wallet_factory):
    """Test successful basename registration with valid parameters."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_wallet.default_address.address_id = MOCK_ADDRESS

    with (
        patch.object(mock_wallet, "invoke_contract") as mock_invoke,
        patch.object(mock_invoke.return_value, "wait") as mock_wait,
    ):
        action_response = register_basename(mock_wallet, MOCK_BASENAME, MOCK_AMOUNT)

        expected_response = (
            f"Successfully registered basename {MOCK_BASENAME} for address {MOCK_ADDRESS}"
        )
        assert action_response == expected_response

        mock_invoke.assert_called_once()
        mock_wait.assert_called_once()


def test_register_basename_contract_error(wallet_factory):
    """Test basename registration when contract error occurs."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_wallet.default_address.address_id = MOCK_ADDRESS

    with patch.object(
        mock_wallet, "invoke_contract", side_effect=Exception("Contract error")
    ) as mock_invoke:
        action_response = register_basename(mock_wallet, MOCK_BASENAME, MOCK_AMOUNT)

        expected_response = "Unexpected error registering basename: Contract error"
        assert action_response == expected_response
        mock_invoke.assert_called_once()


def test_register_basename_auto_suffix(wallet_factory):
    """Test that basename gets correct suffix added automatically."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_wallet.default_address.address_id = MOCK_ADDRESS
    basename_without_suffix = "example"

    with (
        patch.object(mock_wallet, "invoke_contract") as mock_invoke,
        patch.object(mock_invoke.return_value, "wait") as mock_wait,
    ):
        action_response = register_basename(mock_wallet, basename_without_suffix, MOCK_AMOUNT)

        expected_basename = f"{basename_without_suffix}.base.eth"
        expected_response = (
            f"Successfully registered basename {expected_basename} for address {MOCK_ADDRESS}"
        )
        assert action_response == expected_response

        mock_invoke.assert_called_once()
        mock_wait.assert_called_once()


def test_register_basename_testnet_suffix(wallet_factory):
    """Test that basename gets correct testnet suffix on testnet."""
    mock_wallet = wallet_factory(network_id="base-testnet")
    mock_wallet.default_address.address_id = MOCK_ADDRESS
    basename_without_suffix = "example"

    with (
        patch.object(mock_wallet, "invoke_contract") as mock_invoke,
        patch.object(mock_invoke.return_value, "wait") as mock_wait,
    ):
        action_response = register_basename(mock_wallet, basename_without_suffix, MOCK_AMOUNT)

        expected_basename = f"{basename_without_suffix}.basetest.eth"
        expected_response = (
            f"Successfully registered basename {expected_basename} for address {MOCK_ADDRESS}"
        )
        assert action_response == expected_response

        mock_invoke.assert_called_once()
        mock_wait.assert_called_once()
