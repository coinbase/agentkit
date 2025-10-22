"""Tests for ETH Account Wallet Provider transaction operations."""

from decimal import Decimal
from unittest.mock import patch

import pytest

from .conftest import MOCK_ADDRESS, MOCK_ADDRESS_TO, MOCK_ONE_ETH_WEI, MOCK_TX_HASH

# =========================================================
# transaction tests
# =========================================================


def test_send_transaction(wallet_provider, mock_web3):
    """Test send_transaction method."""
    transaction = {
        "to": MOCK_ADDRESS,
        "value": MOCK_ONE_ETH_WEI,
    }

    tx_hash = wallet_provider.send_transaction(transaction)

    assert tx_hash == MOCK_TX_HASH
    mock_web3.to_hex.assert_called_once_with(bytes.fromhex(MOCK_TX_HASH[2:]))


def test_send_transaction_failure(wallet_provider, mock_web3):
    """Test send_transaction method when transaction fails."""
    transaction = {
        "to": MOCK_ADDRESS,
        "value": MOCK_ONE_ETH_WEI,
    }

    mock_web3.return_value.eth.send_transaction.side_effect = Exception("Transaction failed")

    with pytest.raises(Exception, match="Transaction failed"):
        wallet_provider.send_transaction(transaction)


def test_send_transaction_with_network_error(wallet_provider, mock_web3):
    """Test send_transaction method when network connection fails."""
    transaction = {
        "to": MOCK_ADDRESS,
        "value": MOCK_ONE_ETH_WEI,
    }

    mock_web3.return_value.eth.send_transaction.side_effect = ConnectionError(
        "Network connection error"
    )

    with pytest.raises(ConnectionError, match="Network connection error"):
        wallet_provider.send_transaction(transaction)


def test_send_transaction_timeout(wallet_provider, mock_web3):
    """Test send_transaction method when transaction times out."""
    transaction = {
        "to": MOCK_ADDRESS,
        "value": MOCK_ONE_ETH_WEI,
    }

    mock_web3.return_value.eth.send_transaction.side_effect = TimeoutError("Transaction timed out")

    with pytest.raises(TimeoutError, match="Transaction timed out"):
        wallet_provider.send_transaction(transaction)


def test_wait_for_transaction_receipt(wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

    receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

    assert receipt == {"transactionHash": bytes.fromhex(MOCK_TX_HASH[2:])}
    mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
        tx_hash, timeout=120, poll_latency=0.1
    )


def test_wait_for_transaction_receipt_custom_timeout(wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method with custom timeout."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"
    custom_timeout = 300
    custom_poll_latency = 0.5

    receipt = wallet_provider.wait_for_transaction_receipt(
        tx_hash, timeout=custom_timeout, poll_latency=custom_poll_latency
    )

    assert receipt == {"transactionHash": bytes.fromhex(MOCK_TX_HASH[2:])}
    mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
        tx_hash, timeout=custom_timeout, poll_latency=custom_poll_latency
    )


def test_wait_for_transaction_receipt_timeout(wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method when timeout occurs."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

    mock_web3.return_value.eth.wait_for_transaction_receipt.side_effect = Exception(
        "Transaction timeout"
    )

    with pytest.raises(Exception, match="Transaction timeout"):
        wallet_provider.wait_for_transaction_receipt(tx_hash)


def test_native_transfer(wallet_provider, mock_web3):
    """Test native_transfer method."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("1.0")

    with (
        patch.object(wallet_provider, "send_transaction") as mock_send,
        patch.object(wallet_provider, "wait_for_transaction_receipt") as mock_wait,
    ):
        mock_send.return_value = MOCK_TX_HASH
        mock_receipt = {"transactionHash": bytes.fromhex(MOCK_TX_HASH[2:])}
        mock_wait.return_value = mock_receipt

        tx_hash = wallet_provider.native_transfer(to_address, amount)

        expected_hash = MOCK_TX_HASH[2:]
        assert tx_hash == expected_hash
        mock_web3.to_wei.assert_called_with(amount, "ether")
        mock_web3.to_checksum_address.assert_called_with(to_address)
        mock_send.assert_called_once()
        mock_wait.assert_called_once_with(MOCK_TX_HASH)


def test_native_transfer_small_amount(wallet_provider, mock_web3):
    """Test native_transfer method with a very small amount."""
    to_address = MOCK_ADDRESS_TO
    small_amount = Decimal("0.000000001")

    with (
        patch.object(wallet_provider, "send_transaction") as mock_send,
        patch.object(wallet_provider, "wait_for_transaction_receipt") as mock_wait,
    ):
        mock_send.return_value = MOCK_TX_HASH
        mock_receipt = {"transactionHash": bytes.fromhex(MOCK_TX_HASH[2:])}
        mock_wait.return_value = mock_receipt

        tx_hash = wallet_provider.native_transfer(to_address, small_amount)

        expected_hash = MOCK_TX_HASH[2:]
        assert tx_hash == expected_hash
        mock_web3.to_wei.assert_called_with(small_amount, "ether")


def test_native_transfer_failure(wallet_provider, mock_web3):
    """Test native_transfer method when transfer fails."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("1.0")

    with (
        patch.object(wallet_provider, "send_transaction", side_effect=Exception("Transfer failed")),
        pytest.raises(Exception, match="Failed to transfer native tokens"),
    ):
        wallet_provider.native_transfer(to_address, amount)


def test_native_transfer_with_invalid_address(wallet_provider, mock_web3):
    """Test native_transfer method with invalid address."""
    invalid_address = "not_a_valid_address"

    mock_web3.to_checksum_address.side_effect = ValueError("Invalid address format")

    with pytest.raises(Exception, match="Failed to transfer native tokens: Invalid address format"):
        wallet_provider.native_transfer(invalid_address, Decimal("1.0"))
