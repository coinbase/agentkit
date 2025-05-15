"""Tests for CDP Wallet Provider transaction operations."""

from decimal import Decimal

import pytest

from .conftest import (
    MOCK_ADDRESS_TO,
    MOCK_ONE_ETH_WEI,
    MOCK_TRANSACTION_HASH,
)

# =========================================================
# transaction operation tests
# =========================================================


def test_send_transaction(mocked_wallet_provider, mock_cdp_client):
    """Test send_transaction method."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    # The CdpClient mock is already set up to return MOCK_TRANSACTION_HASH
    result = mocked_wallet_provider.send_transaction(transaction)
    assert result == MOCK_TRANSACTION_HASH

    # Verify the send_transaction method was called on the CDP client
    assert mock_cdp_client.evm.send_transaction.called


def test_send_transaction_failure(mocked_wallet_provider, mock_cdp_client):
    """Test send_transaction method when broadcast fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}
    error_msg = "Broadcast failed"

    # Configure mock to raise an exception
    mock_cdp_client.evm.send_transaction.side_effect = Exception(error_msg)

    # Test that the exception is propagated
    with pytest.raises(Exception, match=error_msg):
        mocked_wallet_provider.send_transaction(transaction)


def test_send_transaction_with_network_error(mocked_wallet_provider, mock_cdp_client):
    """Test send_transaction method when network connection fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}
    error_msg = "Network connection error"

    # Configure mock to raise a NetworkError
    mock_cdp_client.evm.send_transaction.side_effect = ConnectionError(error_msg)

    # Test that the exception is propagated
    with pytest.raises(ConnectionError, match=error_msg):
        mocked_wallet_provider.send_transaction(transaction)


def test_send_transaction_timeout(mocked_wallet_provider, mock_cdp_client):
    """Test send_transaction method when transaction times out."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}
    error_msg = "Transaction timed out"

    # Configure mock to raise a TimeoutError
    mock_cdp_client.evm.send_transaction.side_effect = TimeoutError(error_msg)

    # Test that the exception is propagated
    with pytest.raises(TimeoutError, match=error_msg):
        mocked_wallet_provider.send_transaction(transaction)


def test_wait_for_transaction_receipt(mocked_wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

    receipt = mocked_wallet_provider.wait_for_transaction_receipt(tx_hash)

    assert receipt == {"transactionHash": bytes.fromhex(MOCK_TRANSACTION_HASH[2:])}
    mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
        tx_hash, timeout=120, poll_latency=0.1
    )


def test_wait_for_transaction_receipt_custom_timeout(mocked_wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method with custom timeout."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"
    custom_timeout = 300
    custom_poll_latency = 0.5

    receipt = mocked_wallet_provider.wait_for_transaction_receipt(
        tx_hash, timeout=custom_timeout, poll_latency=custom_poll_latency
    )

    assert receipt == {"transactionHash": bytes.fromhex(MOCK_TRANSACTION_HASH[2:])}
    mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
        tx_hash, timeout=custom_timeout, poll_latency=custom_poll_latency
    )


def test_wait_for_transaction_receipt_timeout(mocked_wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method when timeout occurs."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"
    error_msg = "Transaction timeout"

    mock_web3.return_value.eth.wait_for_transaction_receipt.side_effect = Exception(error_msg)

    with pytest.raises(Exception, match=error_msg):
        mocked_wallet_provider.wait_for_transaction_receipt(tx_hash)


def test_native_transfer(mocked_wallet_provider, mock_cdp_client, mock_web3):
    """Test native_transfer method."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0.5")

    # Configuration to ensure native_transfer works correctly
    mock_web3.to_checksum_address.return_value = to_address
    mock_web3.to_wei.return_value = MOCK_ONE_ETH_WEI

    # The method should return transaction hash from the mock
    tx_hash = mocked_wallet_provider.native_transfer(to_address, amount)

    # Verify the result and that send_transaction was called
    assert tx_hash == MOCK_TRANSACTION_HASH
    assert mock_cdp_client.evm.send_transaction.called


def test_native_transfer_small_amount(mocked_wallet_provider, mock_cdp_client, mock_web3):
    """Test native_transfer method with a very small amount."""
    to_address = MOCK_ADDRESS_TO
    small_amount = Decimal("0.000000001")

    # Set a small wei amount
    mock_web3.to_wei.return_value = 1
    mock_web3.to_checksum_address.return_value = to_address

    # Execute the transfer
    tx_hash = mocked_wallet_provider.native_transfer(to_address, small_amount)

    # Verify the result
    assert tx_hash == MOCK_TRANSACTION_HASH
    assert mock_cdp_client.evm.send_transaction.called


def test_native_transfer_failure(mocked_wallet_provider, mock_cdp_client, mock_web3):
    """Test native_transfer method when transfer fails."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0.5")
    error_msg = "Transfer failed"

    # Configure error behavior
    mock_cdp_client.evm.send_transaction.side_effect = Exception(error_msg)

    # Test that the exception is propagated
    with pytest.raises(Exception, match=error_msg):
        mocked_wallet_provider.native_transfer(to_address, amount)


def test_native_transfer_with_invalid_address(mocked_wallet_provider, mock_cdp_client, mock_web3):
    """Test native_transfer method with invalid address."""
    invalid_address = "not_a_valid_address"
    amount = Decimal("1.0")
    error_msg = "Invalid address format"

    # Configure CDP client to raise exception for invalid addresses
    # This simulates what would happen in the actual CDP client for invalid addresses
    mock_cdp_client.evm.send_transaction.side_effect = ValueError(error_msg)

    # Test that the exception is propagated
    with pytest.raises(ValueError, match=error_msg):
        mocked_wallet_provider.native_transfer(invalid_address, amount)
