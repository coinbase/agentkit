"""Tests for native transfer functionality."""

from decimal import Decimal

import pytest
from pydantic import ValidationError
from web3.types import HexStr

from coinbase_agentkit.action_providers.wallet.schemas import NativeTransferSchema

from .conftest import MOCK_ADDRESS

MOCK_TX_HASH = HexStr("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
MOCK_ETH_AMOUNT = "0.0001"
INVALID_ADDRESS = "not-an-address"
INVALID_AMOUNT = "not-a-number"


def test_native_transfer_schema_valid():
    """Test that NativeTransferInput accepts valid parameters."""
    schema = NativeTransferSchema(
        to=MOCK_ADDRESS,
        value=MOCK_ETH_AMOUNT,
    )
    assert isinstance(schema, NativeTransferSchema)
    assert schema.to == MOCK_ADDRESS
    assert schema.value == MOCK_ETH_AMOUNT


def test_native_transfer_schema_invalid_value():
    """Test that NativeTransferInput rejects invalid values."""
    with pytest.raises(
        ValidationError, match=r"Invalid decimal format. Must be a positive number."
    ):
        NativeTransferSchema(
            to=MOCK_ADDRESS,
            value=INVALID_AMOUNT,
        )

    with pytest.raises(
        ValidationError, match=r"Invalid decimal format. Must be a positive number."
    ):
        NativeTransferSchema(
            to=MOCK_ADDRESS,
            value="-1.5",
        )

    with pytest.raises(ValidationError, match=r"Failed to parse decimal value"):
        NativeTransferSchema(
            to=MOCK_ADDRESS,
            value="0",
        )


def test_native_transfer_success(wallet_action_provider, mock_wallet_provider):
    """Test successful native transfer."""
    mock_wallet_provider.native_transfer.return_value = MOCK_TX_HASH

    args = {
        "to": MOCK_ADDRESS,
        "value": MOCK_ETH_AMOUNT,
    }

    result = wallet_action_provider.native_transfer(mock_wallet_provider, args)
    # Check for key parts of the response message
    assert f"Transferred {MOCK_ETH_AMOUNT}" in result
    assert MOCK_ADDRESS in result
    assert MOCK_TX_HASH in result

    # Verify native_transfer was called with Decimal, not string
    mock_wallet_provider.native_transfer.assert_called_once_with(
        MOCK_ADDRESS, Decimal(MOCK_ETH_AMOUNT)
    )


def test_native_transfer_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling in native transfer."""
    error_message = "Failed to transfer"
    mock_wallet_provider.native_transfer.side_effect = Exception(error_message)

    args = {
        "to": MOCK_ADDRESS,
        "value": MOCK_ETH_AMOUNT,
    }

    result = wallet_action_provider.native_transfer(mock_wallet_provider, args)
    assert "Error during" in result
    assert error_message in result

    # Verify native_transfer was called with Decimal, not string
    mock_wallet_provider.native_transfer.assert_called_once_with(
        MOCK_ADDRESS, Decimal(MOCK_ETH_AMOUNT)
    )


def test_native_transfer_insufficient_balance(wallet_action_provider, mock_wallet_provider):
    """Test native transfer with insufficient balance."""
    error_message = "Insufficient balance"
    mock_wallet_provider.native_transfer.side_effect = ValueError(error_message)

    args = {
        "to": MOCK_ADDRESS,
        "value": MOCK_ETH_AMOUNT,
    }

    result = wallet_action_provider.native_transfer(mock_wallet_provider, args)
    assert "Error during" in result
    assert error_message in result

    # Verify native_transfer was called with Decimal, not string
    mock_wallet_provider.native_transfer.assert_called_once_with(
        MOCK_ADDRESS, Decimal(MOCK_ETH_AMOUNT)
    )
