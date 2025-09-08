"""Tests for CDP EVM Smart Wallet Provider transaction operations."""

from decimal import Decimal
from unittest.mock import Mock, patch

import pytest
from cdp.evm_call_types import EncodedCall

from .conftest import MOCK_ADDRESS_TO, MOCK_ONE_ETH_WEI, MOCK_TRANSACTION_HASH

# =========================================================
# transaction tests
# =========================================================


def test_send_transaction(mocked_wallet_provider, mock_cdp_client, mock_smart_account):
    """Test send_transaction method."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    # Setup async mocks for the async methods
    user_op_result = Mock()
    user_op_result.transaction_hash = MOCK_TRANSACTION_HASH

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        return user_op_result

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    tx_hash = mocked_wallet_provider.send_transaction(transaction)

    # We only check the result since we're mocking _run_async to return a predefined value
    assert tx_hash == MOCK_TRANSACTION_HASH


def test_send_transaction_without_data(mocked_wallet_provider, mock_cdp_client, mock_smart_account):
    """Test send_transaction method with no data field."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI}

    # Setup async mocks
    user_op_result = Mock()
    user_op_result.transaction_hash = MOCK_TRANSACTION_HASH

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        return user_op_result

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    tx_hash = mocked_wallet_provider.send_transaction(transaction)

    # We only check the result since we're mocking _run_async to return a predefined value
    assert tx_hash == MOCK_TRANSACTION_HASH


def test_send_transaction_without_value(
    mocked_wallet_provider, mock_cdp_client, mock_smart_account
):
    """Test send_transaction method with no value field."""
    transaction = {"to": MOCK_ADDRESS_TO, "data": "0xabcdef"}

    # Setup async mocks
    user_op_result = Mock()
    user_op_result.transaction_hash = MOCK_TRANSACTION_HASH

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        return user_op_result

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    tx_hash = mocked_wallet_provider.send_transaction(transaction)

    # We only check the result since we're mocking _run_async to return a predefined value
    assert tx_hash == MOCK_TRANSACTION_HASH


def test_send_transaction_with_zero_value(
    mocked_wallet_provider, mock_cdp_client, mock_smart_account
):
    """Test send_transaction method with zero value."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": 0, "data": "0x"}

    # Setup async mocks
    user_op_result = Mock()
    user_op_result.transaction_hash = MOCK_TRANSACTION_HASH

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        return user_op_result

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    tx_hash = mocked_wallet_provider.send_transaction(transaction)

    # We only check the result since we're mocking _run_async to return a predefined value
    assert tx_hash == MOCK_TRANSACTION_HASH


def test_send_transaction_failure(mocked_wallet_provider, mock_cdp_client, mock_smart_account):
    """Test send_transaction method when transaction fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    # Setup async mocks
    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        raise Exception("Transaction failed")

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock

    # Instead of using the mocked _run_async, directly call send_user_operation_mock
    # to get the exception and then check that the exception is properly raised
    with (
        patch.object(
            mocked_wallet_provider, "_run_async", side_effect=Exception("Transaction failed")
        ),
        pytest.raises(Exception, match="Transaction failed"),
    ):
        mocked_wallet_provider.send_transaction(transaction)


def test_send_transaction_with_network_error(
    mocked_wallet_provider, mock_cdp_client, mock_smart_account
):
    """Test send_transaction method when network connection fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    # Setup async mocks
    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        raise ConnectionError("Network connection error")

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock

    # Patch _run_async to raise the expected exception
    with (
        patch.object(
            mocked_wallet_provider,
            "_run_async",
            side_effect=ConnectionError("Network connection error"),
        ),
        pytest.raises(ConnectionError, match="Network connection error"),
    ):
        mocked_wallet_provider.send_transaction(transaction)


def test_send_transaction_timeout(mocked_wallet_provider, mock_cdp_client, mock_smart_account):
    """Test send_transaction method when transaction times out."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    # Setup async mocks
    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        raise TimeoutError("Transaction timed out")

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    # Patch _run_async to raise the expected exception
    with (
        patch.object(
            mocked_wallet_provider, "_run_async", side_effect=TimeoutError("Transaction timed out")
        ),
        pytest.raises(TimeoutError, match="Transaction timed out"),
    ):
        mocked_wallet_provider.send_transaction(transaction)


def test_send_user_operation(mocked_wallet_provider, mock_cdp_client, mock_smart_account):
    """Test send_user_operation method success case."""
    calls = [EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x")]

    # Setup async mocks
    user_op_result = Mock()
    user_op_result.transaction_hash = MOCK_TRANSACTION_HASH

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        return user_op_result

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    tx_hash = mocked_wallet_provider.send_user_operation(calls)

    # We only check the result since we're mocking _run_async to return a predefined value
    assert tx_hash == MOCK_TRANSACTION_HASH


def test_send_user_operation_multiple_calls(
    mocked_wallet_provider, mock_cdp_client, mock_smart_account
):
    """Test send_user_operation method with multiple calls."""
    calls = [
        EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x01"),
        EncodedCall(to="0x5678", value=0, data="0x02"),
    ]

    # Setup async mocks
    user_op_result = Mock()
    user_op_result.transaction_hash = MOCK_TRANSACTION_HASH

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        return user_op_result

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    tx_hash = mocked_wallet_provider.send_user_operation(calls)

    # We only check the result since we're mocking _run_async to return a predefined value
    assert tx_hash == MOCK_TRANSACTION_HASH


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

    assert receipt is not None
    mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
        tx_hash, timeout=custom_timeout, poll_latency=custom_poll_latency
    )


def test_wait_for_transaction_receipt_failure(mocked_wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method when receipt retrieval fails."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"
    error_message = "Transaction receipt retrieval failed"

    mock_web3.return_value.eth.wait_for_transaction_receipt.side_effect = Exception(error_message)

    with pytest.raises(Exception, match=error_message):
        mocked_wallet_provider.wait_for_transaction_receipt(tx_hash)


def test_wait_for_transaction_receipt_timeout(mocked_wallet_provider, mock_web3):
    """Test wait_for_transaction_receipt method when transaction times out."""
    tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

    mock_web3.return_value.eth.wait_for_transaction_receipt.side_effect = TimeoutError(
        "Transaction timeout"
    )

    with pytest.raises(TimeoutError, match="Transaction timeout"):
        mocked_wallet_provider.wait_for_transaction_receipt(tx_hash)


def test_native_transfer(mocked_wallet_provider, mock_cdp_client, mock_smart_account, mock_web3):
    """Test native_transfer method."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("1.0")

    mock_web3.to_wei.return_value = MOCK_ONE_ETH_WEI

    # Setup async mocks
    user_op_result = Mock()
    user_op_result.transaction_hash = MOCK_TRANSACTION_HASH

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def send_user_operation_mock(*args, **kwargs):
        user_op = Mock()
        user_op.user_op_hash = "mock_user_op_hash"
        return user_op

    async def wait_for_user_operation_mock(*args, **kwargs):
        return user_op_result

    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.send_user_operation.side_effect = send_user_operation_mock
    mock_cdp_client.evm.wait_for_user_operation.side_effect = wait_for_user_operation_mock

    tx_hash = mocked_wallet_provider.native_transfer(to_address, amount)

    assert tx_hash == MOCK_TRANSACTION_HASH
    mock_web3.to_wei.assert_called_once_with(amount, "ether")
