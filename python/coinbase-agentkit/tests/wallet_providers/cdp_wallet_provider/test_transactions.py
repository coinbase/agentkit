"""Tests for CDP Wallet Provider transaction operations."""

from decimal import Decimal
from unittest.mock import Mock, call, patch

import pytest

from .conftest import (
    MOCK_ADDRESS,
    MOCK_ADDRESS_TO,
    MOCK_NETWORK_ID,
    MOCK_ONE_ETH_WEI,
    MOCK_TRANSACTION_HASH,
)

# =========================================================
# transaction operation tests
# =========================================================


def test_send_transaction(mocked_wallet_provider):
    """Test send_transaction method."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    with (
        patch.object(mocked_wallet_provider, "sign_transaction") as mock_sign,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.DynamicFeeTransaction"
        ) as mock_tx,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.ExternalAddress"
        ) as mock_addr,
    ):
        # sig format: 0x + r(64 chars) + s(64 chars) + v(2 chars)
        hex_signature = "0x" + "a" * 64 + "b" * 64 + "1b"
        mock_sign.return_value = hex_signature

        mock_tx_instance = Mock()
        mock_tx_instance.payload.return_value = bytes.fromhex("1234")
        mock_tx.from_dict.return_value = mock_tx_instance

        mock_addr_instance = Mock()
        mock_addr.return_value = mock_addr_instance
        mock_broadcast_result = Mock()
        mock_broadcast_result.transaction_hash = MOCK_TRANSACTION_HASH
        mock_addr_instance.broadcast_external_transaction.return_value = mock_broadcast_result

        tx_hash = mocked_wallet_provider.send_transaction(transaction)

        assert tx_hash == MOCK_TRANSACTION_HASH
        mock_sign.assert_called_once()
        mock_addr.assert_called_once_with(MOCK_NETWORK_ID, MOCK_ADDRESS)
        mock_addr_instance.broadcast_external_transaction.assert_called_once_with("021234")


def test_send_transaction_failure(mocked_wallet_provider):
    """Test send_transaction method when broadcast fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    with (
        patch.object(mocked_wallet_provider, "sign_transaction") as mock_sign,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.DynamicFeeTransaction"
        ) as mock_tx,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.ExternalAddress"
        ) as mock_addr,
    ):
        # sig format: 0x + r(64 chars) + s(64 chars) + v(2 chars)
        hex_signature = "0x" + "a" * 64 + "b" * 64 + "1b"
        mock_sign.return_value = hex_signature

        mock_tx_instance = Mock()
        mock_tx_instance.payload.return_value = bytes.fromhex("1234")
        mock_tx.from_dict.return_value = mock_tx_instance

        mock_addr_instance = Mock()
        mock_addr.return_value = mock_addr_instance
        mock_addr_instance.broadcast_external_transaction.side_effect = Exception(
            "Broadcast failed"
        )

        with pytest.raises(Exception, match="Broadcast failed"):
            mocked_wallet_provider.send_transaction(transaction)


def test_send_transaction_with_network_error(mocked_wallet_provider):
    """Test send_transaction method when network connection fails."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    with (
        patch.object(mocked_wallet_provider, "sign_transaction") as mock_sign,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.DynamicFeeTransaction"
        ) as mock_tx,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.ExternalAddress"
        ) as mock_addr,
    ):
        # sig format: 0x + r(64 chars) + s(64 chars) + v(2 chars)
        hex_signature = "0x" + "a" * 64 + "b" * 64 + "1b"
        mock_sign.return_value = hex_signature

        mock_tx_instance = Mock()
        mock_tx_instance.payload.return_value = bytes.fromhex("1234")
        mock_tx.from_dict.return_value = mock_tx_instance

        mock_addr_instance = Mock()
        mock_addr.return_value = mock_addr_instance
        mock_addr_instance.broadcast_external_transaction.side_effect = ConnectionError(
            "Network connection error"
        )

        with pytest.raises(Exception, match="Network connection error"):
            mocked_wallet_provider.send_transaction(transaction)


def test_send_transaction_timeout(mocked_wallet_provider):
    """Test send_transaction method when transaction times out."""
    transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

    with (
        patch.object(mocked_wallet_provider, "sign_transaction") as mock_sign,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.DynamicFeeTransaction"
        ) as mock_tx,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.ExternalAddress"
        ) as mock_addr,
    ):
        # sig format: 0x + r(64 chars) + s(64 chars) + v(2 chars)
        hex_signature = "0x" + "a" * 64 + "b" * 64 + "1b"
        mock_sign.return_value = hex_signature

        mock_tx_instance = Mock()
        mock_tx_instance.payload.return_value = bytes.fromhex("1234")
        mock_tx.from_dict.return_value = mock_tx_instance

        mock_addr_instance = Mock()
        mock_addr.return_value = mock_addr_instance
        mock_addr_instance.broadcast_external_transaction.side_effect = TimeoutError(
            "Transaction timed out"
        )

        with pytest.raises(Exception, match="Transaction timed out"):
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

    mock_web3.return_value.eth.wait_for_transaction_receipt.side_effect = Exception(
        "Transaction timeout"
    )

    with pytest.raises(Exception, match="Transaction timeout"):
        mocked_wallet_provider.wait_for_transaction_receipt(tx_hash)


def test_native_transfer(mocked_wallet_provider, mock_wallet):
    """Test native_transfer method."""
    provider_wallet = mocked_wallet_provider._wallet
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0.5")

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_checksum_address",
        return_value=to_address,
    ):
        tx_hash = mocked_wallet_provider.native_transfer(to_address, amount)

        assert tx_hash == MOCK_TRANSACTION_HASH
        provider_wallet.transfer.assert_called_once_with(
            amount=amount, asset_id="eth", destination=to_address, gasless=False
        )


def test_native_transfer_small_amount(mocked_wallet_provider, mock_wallet):
    """Test native_transfer method with a very small amount."""
    provider_wallet = mocked_wallet_provider._wallet
    to_address = MOCK_ADDRESS_TO
    small_amount = Decimal("0.000000001")

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_checksum_address",
        return_value=to_address,
    ):
        tx_hash = mocked_wallet_provider.native_transfer(to_address, small_amount)

        assert tx_hash == MOCK_TRANSACTION_HASH
        provider_wallet.transfer.assert_called_once_with(
            amount=small_amount, asset_id="eth", destination=to_address, gasless=False
        )


def test_native_transfer_without_wallet(mocked_wallet_provider):
    """Test native_transfer method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.native_transfer("0x1234", Decimal("0.5"))


def test_native_transfer_failure(mocked_wallet_provider, mock_wallet):
    """Test native_transfer method when transfer fails."""
    mock_wallet.transfer.side_effect = Exception("Transfer failed")

    with pytest.raises(Exception, match="Failed to transfer native tokens"):
        mocked_wallet_provider.native_transfer("0x1234", Decimal("0.5"))


def test_native_transfer_with_invalid_address(mocked_wallet_provider):
    """Test native_transfer method with invalid address."""
    invalid_address = "not_a_valid_address"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_checksum_address",
            side_effect=ValueError("Invalid address format"),
        ),
        pytest.raises(Exception, match="Failed to transfer native tokens"),
    ):
        mocked_wallet_provider.native_transfer(invalid_address, Decimal("1.0"))


def test_gasless_transfer(mocked_wallet_provider, mock_wallet):
    """Test gasless transfer functionality."""
    provider_wallet = mocked_wallet_provider._wallet
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("10.0")
    asset_id = "usdc"

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_checksum_address",
        return_value=to_address,
    ):
        provider_wallet.transfer.return_value.transaction_hash = MOCK_TRANSACTION_HASH
        provider_wallet.transfer.reset_mock()

        _ = provider_wallet.transfer(
            amount=amount, asset_id=asset_id, destination=to_address, gasless=True
        )

        expected_call = call(amount=amount, asset_id=asset_id, destination=to_address, gasless=True)
        assert expected_call in provider_wallet.transfer.call_args_list
