"""Tests for CDP Wallet Provider signing operations."""

from unittest.mock import Mock, patch

import pytest

from .conftest import (
    MOCK_ADDRESS_TO,
    MOCK_CHAIN_ID,
    MOCK_GAS_LIMIT,
    MOCK_MAX_FEE_PER_GAS,
    MOCK_ONE_ETH_WEI,
    MOCK_PRIORITY_FEE_PER_GAS,
    MOCK_SIGNATURE,
)

# =========================================================
# signing operation tests
# =========================================================


def test_sign_message(mocked_wallet_provider, mock_wallet):
    """Test sign_message method."""
    message = "Hello, world!"

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.hash_message"
    ) as mock_hash_message:
        mock_hash_message.return_value = "mock_hash"

        signature = mocked_wallet_provider.sign_message(message)

        assert signature == MOCK_SIGNATURE
        mock_hash_message.assert_called_once_with(message)
        mock_wallet.sign_payload.assert_called_once_with("mock_hash")


def test_sign_message_binary(mocked_wallet_provider, mock_wallet):
    """Test sign_message method with binary data."""
    binary_message = b"Binary data"

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.hash_message"
    ) as mock_hash_message:
        mock_hash_message.return_value = "mock_hash"

        signature = mocked_wallet_provider.sign_message(binary_message)

        assert signature == MOCK_SIGNATURE
        mock_hash_message.assert_called_once_with(binary_message)
        mock_wallet.sign_payload.assert_called_once_with("mock_hash")


def test_sign_message_without_wallet(mocked_wallet_provider):
    """Test sign_message method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.sign_message("Hello, world!")


def test_sign_message_failure(mocked_wallet_provider, mock_wallet):
    """Test sign_message method when signing fails."""
    message = "Hello, world!"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.hash_message"
        ) as mock_hash_message,
        patch.object(mock_wallet, "sign_payload", side_effect=Exception("Signing failed")),
    ):
        mock_hash_message.return_value = "mock_hash"

        with pytest.raises(Exception, match="Signing failed"):
            mocked_wallet_provider.sign_message(message)


def test_sign_typed_data(mocked_wallet_provider, mock_wallet):
    """Test sign_typed_data method."""
    typed_data = {
        "types": {"EIP712Domain": []},
        "primaryType": "Test",
        "domain": {},
        "message": {},
    }

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.hash_typed_data_message"
    ) as mock_hash:
        mock_hash.return_value = "mock_hash"

        signature = mocked_wallet_provider.sign_typed_data(typed_data)

        assert signature == MOCK_SIGNATURE
        mock_hash.assert_called_once_with(typed_data)
        mock_wallet.sign_payload.assert_called_once_with("mock_hash")


def test_sign_typed_data_without_wallet(mocked_wallet_provider):
    """Test sign_typed_data method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    typed_data = {
        "types": {"EIP712Domain": []},
        "primaryType": "Test",
        "domain": {},
        "message": {},
    }

    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.sign_typed_data(typed_data)


def test_sign_transaction(mocked_wallet_provider, mock_wallet):
    """Test sign_transaction method."""
    transaction = {
        "to": MOCK_ADDRESS_TO,
        "value": MOCK_ONE_ETH_WEI,
        "data": "0x",
        "nonce": 0,
        "gas": MOCK_GAS_LIMIT,
        "maxFeePerGas": MOCK_MAX_FEE_PER_GAS,
        "maxPriorityFeePerGas": MOCK_PRIORITY_FEE_PER_GAS,
        "chainId": MOCK_CHAIN_ID,
        "type": 2,
    }

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.DynamicFeeTransaction"
    ) as mock_tx:
        mock_tx_instance = Mock()
        mock_tx_instance.hash.return_value = bytes.fromhex("abcdef")
        mock_tx.from_dict.return_value = mock_tx_instance

        signature = mocked_wallet_provider.sign_transaction(transaction)

        assert signature == MOCK_SIGNATURE
        mock_tx.from_dict.assert_called_once_with(transaction)
        mock_wallet.sign_payload.assert_called_once_with("abcdef")


def test_sign_transaction_without_wallet(mocked_wallet_provider):
    """Test sign_transaction method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.sign_transaction({})
