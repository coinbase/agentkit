"""Tests for Smart Wallet Provider transaction operations."""

from decimal import Decimal
from unittest.mock import Mock

import pytest
from cdp import EncodedCall, UserOperation

from .conftest import MOCK_ADDRESS_TO, MOCK_ONE_ETH_WEI, MOCK_TRANSACTION_HASH

# =========================================================
# transaction tests
# =========================================================


def test_send_transaction(wallet_provider, mock_smart_wallet):
    """Test send_transaction method."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    tx_hash = wallet_provider.send_transaction(transaction)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_smart_wallet.send_user_operation.assert_called_once()

    call_args = mock_smart_wallet.send_user_operation.call_args[1]["calls"][0]
    assert call_args.to == transaction["to"]
    assert call_args.value == transaction["value"]
    assert call_args.data == transaction["data"]


def test_send_transaction_without_data(wallet_provider, mock_smart_wallet):
    """Test send_transaction method with no data field."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI}

    tx_hash = wallet_provider.send_transaction(transaction)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_smart_wallet.send_user_operation.assert_called_once()

    call_args = mock_smart_wallet.send_user_operation.call_args[1]["calls"][0]
    assert call_args.to == transaction["to"]
    assert call_args.value == transaction["value"]
    assert call_args.data == "" or call_args.data == b"" or call_args.data == "0x"


def test_send_transaction_without_value(wallet_provider, mock_smart_wallet):
    """Test send_transaction method with no value field."""
    transaction = {"to": MOCK_ADDRESS_TO, "data": "0xabcdef"}

    tx_hash = wallet_provider.send_transaction(transaction)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_smart_wallet.send_user_operation.assert_called_once()

    call_args = mock_smart_wallet.send_user_operation.call_args[1]["calls"][0]
    assert call_args.to == transaction["to"]
    assert call_args.value == 0
    assert call_args.data == transaction["data"]


def test_send_transaction_with_zero_value(wallet_provider, mock_smart_wallet):
    """Test send_transaction method with zero value."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": 0, "data": "0x"}

    tx_hash = wallet_provider.send_transaction(transaction)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_smart_wallet.send_user_operation.assert_called_once()

    call_args = mock_smart_wallet.send_user_operation.call_args[1]["calls"][0]
    assert call_args.value == 0


def test_send_transaction_failure(wallet_provider, mock_smart_wallet):
    """Test send_transaction method when transaction fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    user_operation = Mock(spec=UserOperation)
    result = Mock()
    result.status = UserOperation.Status.FAILED
    user_operation.wait.return_value = result
    mock_smart_wallet.send_user_operation.return_value = user_operation

    with pytest.raises(Exception, match="Transaction failed"):
        wallet_provider.send_transaction(transaction)


def test_send_transaction_with_network_error(wallet_provider, mock_smart_wallet):
    """Test send_transaction method when network connection fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    mock_smart_wallet.send_user_operation.side_effect = ConnectionError("Network connection error")

    with pytest.raises(ConnectionError, match="Network connection error"):
        wallet_provider.send_transaction(transaction)


def test_send_transaction_timeout(wallet_provider, mock_smart_wallet):
    """Test send_transaction method when transaction times out."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    user_operation = Mock(spec=UserOperation)
    user_operation.wait.side_effect = TimeoutError("Transaction timed out")
    mock_smart_wallet.send_user_operation.return_value = user_operation

    with pytest.raises(TimeoutError, match="Transaction timed out"):
        wallet_provider.send_transaction(transaction)


def test_send_transaction_other_status(wallet_provider, mock_smart_wallet):
    """Test send_transaction method with non-complete, non-failed status."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    user_operation = Mock(spec=UserOperation)
    result = Mock()
    result.status = UserOperation.Status.PENDING
    user_operation.wait.return_value = result
    mock_smart_wallet.send_user_operation.return_value = user_operation

    with pytest.raises(Exception, match="Transaction failed"):
        wallet_provider.send_transaction(transaction)


def test_send_user_operation_success(wallet_provider, mock_smart_wallet):
    """Test send_user_operation method success case."""
    calls = [EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x")]

    tx_hash = wallet_provider.send_user_operation(calls)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_smart_wallet.send_user_operation.assert_called_once_with(calls=calls)


def test_send_user_operation_multiple_calls(wallet_provider, mock_smart_wallet):
    """Test send_user_operation method with multiple calls."""
    calls = [
        EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x01"),
        EncodedCall(to="0x5678", value=0, data="0x02"),
    ]

    tx_hash = wallet_provider.send_user_operation(calls)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_smart_wallet.send_user_operation.assert_called_once_with(calls=calls)


def test_send_user_operation_failure(wallet_provider, mock_smart_wallet):
    """Test send_user_operation method failure case."""
    user_operation = Mock(spec=UserOperation)
    result = Mock()
    result.status = UserOperation.Status.FAILED
    user_operation.wait.return_value = result
    mock_smart_wallet.send_user_operation.return_value = user_operation

    calls = [EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x")]

    with pytest.raises(Exception, match="Operation failed with status"):
        wallet_provider.send_user_operation(calls)


def test_send_user_operation_timeout(wallet_provider, mock_smart_wallet):
    """Test send_user_operation method when operation times out."""
    calls = [EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x")]

    user_operation = Mock(spec=UserOperation)
    user_operation.wait.side_effect = TimeoutError("Operation timed out")
    mock_smart_wallet.send_user_operation.return_value = user_operation

    with pytest.raises(TimeoutError, match="Operation timed out"):
        wallet_provider.send_user_operation(calls)


def test_wait_for_transaction_receipt(wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

    receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

    assert receipt == {"transactionHash": bytes.fromhex(MOCK_TRANSACTION_HASH[2:])}
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

    assert receipt is not None
    mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
        tx_hash, timeout=custom_timeout, poll_latency=custom_poll_latency
    )


def test_wait_for_transaction_receipt_failure(wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method when receipt retrieval fails."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"
    error_message = "Transaction receipt retrieval failed"

    mock_web3.return_value.eth.wait_for_transaction_receipt.side_effect = Exception(error_message)

    with pytest.raises(Exception, match=error_message):
        wallet_provider.wait_for_transaction_receipt(tx_hash)


def test_wait_for_transaction_receipt_timeout(wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method when transaction times out."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

    mock_web3.return_value.eth.wait_for_transaction_receipt.side_effect = TimeoutError(
        "Transaction timeout"
    )

    with pytest.raises(TimeoutError, match="Transaction timeout"):
        wallet_provider.wait_for_transaction_receipt(tx_hash)


def test_native_transfer(wallet_provider, mock_smart_wallet, mock_web3):
    """Test native_transfer method."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("1.0")

    mock_web3.to_wei.return_value = MOCK_ONE_ETH_WEI

    tx_hash = wallet_provider.native_transfer(to_address, amount)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_web3.to_wei.assert_called_once_with(amount, "ether")
    mock_smart_wallet.send_user_operation.assert_called_once()

    call_args = mock_smart_wallet.send_user_operation.call_args[1]["calls"][0]
    assert call_args.to == to_address
    assert call_args.value == MOCK_ONE_ETH_WEI
    assert call_args.data == "0x"


def test_native_transfer_failure(wallet_provider, mock_smart_wallet):
    """Test native_transfer method failure case."""
    user_operation = Mock(spec=UserOperation)
    result = Mock()
    result.status = UserOperation.Status.FAILED
    user_operation.wait.return_value = result
    mock_smart_wallet.send_user_operation.return_value = user_operation

    with pytest.raises(Exception, match="Transaction failed"):
        wallet_provider.native_transfer("0x1234", Decimal("1.0"))


def test_native_transfer_with_invalid_address(wallet_provider, mock_smart_wallet):
    """Test native_transfer method with invalid address."""
    invalid_address = "not_a_valid_address"

    mock_smart_wallet.send_user_operation.side_effect = ValueError("Invalid address format")

    with pytest.raises(ValueError, match="Invalid address format"):
        wallet_provider.native_transfer(invalid_address, Decimal("1.0"))
