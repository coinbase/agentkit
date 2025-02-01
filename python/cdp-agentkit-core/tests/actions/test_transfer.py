from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.transfer import (
    TransferInput,
    transfer,
)

MOCK_AMOUNT = "0.01"
MOCK_ASSET_ID = "usdc"
MOCK_DESTINATION = "example.eth"
MOCK_GASLESS = True


def test_transfer_input_model_valid():
    """Test that TransferInput accepts valid parameters."""
    input_model = TransferInput(
        amount=MOCK_AMOUNT,
        asset_id=MOCK_ASSET_ID,
        destination=MOCK_DESTINATION,
        gasless=MOCK_GASLESS,
    )

    assert input_model.amount == MOCK_AMOUNT
    assert input_model.asset_id == MOCK_ASSET_ID
    assert input_model.destination == MOCK_DESTINATION
    assert input_model.gasless is MOCK_GASLESS


def test_transfer_input_model_missing_params():
    """Test that TransferInput raises error when params are missing."""
    with pytest.raises(ValueError):
        TransferInput()


def test_transfer_success(wallet_factory, transfer_factory):
    """Test successful transfer with valid parameters."""
    mock_wallet = wallet_factory()
    mock_transfer_instance = transfer_factory()

    with (
        patch.object(mock_wallet, "transfer", return_value=mock_transfer_instance) as mock_transfer,
        patch.object(
            mock_transfer_instance, "wait", return_value=mock_transfer_instance
        ) as mock_transfer_wait,
    ):
        action_response = transfer(
            mock_wallet, MOCK_AMOUNT, MOCK_ASSET_ID, MOCK_DESTINATION, MOCK_GASLESS
        )

        expected_response = f"Transferred {MOCK_AMOUNT} of {MOCK_ASSET_ID} to {MOCK_DESTINATION}.\nTransaction hash for the transfer: {mock_transfer_instance.transaction_hash}\nTransaction link for the transfer: {mock_transfer_instance.transaction_link}"
        assert action_response == expected_response
        mock_transfer.assert_called_once_with(
            amount=MOCK_AMOUNT,
            asset_id=MOCK_ASSET_ID,
            destination=MOCK_DESTINATION,
            gasless=MOCK_GASLESS,
        )
        mock_transfer_wait.assert_called_once_with()


def test_transfer_api_error(wallet_factory):
    """Test transfer when API error occurs."""
    mock_wallet = wallet_factory()

    with patch.object(mock_wallet, "transfer", side_effect=Exception("API error")) as mock_transfer:
        action_response = transfer(
            mock_wallet, MOCK_AMOUNT, MOCK_ASSET_ID, MOCK_DESTINATION, MOCK_GASLESS
        )

        expected_response = "Error transferring the asset API error"

        assert action_response == expected_response
        mock_transfer.assert_called_once_with(
            amount=MOCK_AMOUNT,
            asset_id=MOCK_ASSET_ID,
            destination=MOCK_DESTINATION,
            gasless=MOCK_GASLESS,
        )
