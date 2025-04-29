"""Tests for ETH Account Wallet Provider signing operations."""

from unittest.mock import patch

import pytest

from .conftest import (
    MOCK_ADDRESS_TO,
    MOCK_CHAIN_ID,
    MOCK_GAS_LIMIT,
    MOCK_GAS_PRICE,
    MOCK_ONE_ETH_WEI,
    MOCK_SIGNATURE_BYTES,
)

# =========================================================
# signing tests
# =========================================================


def test_sign_message(wallet_provider, mock_account):
    """Test sign_message method."""
    message = "Hello, world!"

    with patch(
        "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.encode_defunct"
    ) as mock_encode:
        mock_encode.return_value = "encoded_message"

        signature = wallet_provider.sign_message(message)

        assert signature == MOCK_SIGNATURE_BYTES
        mock_encode.assert_called_once_with(
            message.encode() if isinstance(message, str) else message
        )
        mock_account.sign_message.assert_called_once_with("encoded_message")
        assert mock_encode.call_count == 1


def test_sign_message_binary(wallet_provider, mock_account):
    """Test sign_message method with binary message."""
    message = b"Hello, world!"

    with patch(
        "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.encode_defunct"
    ) as mock_encode:
        mock_encode.return_value = "encoded_message"

        signature = wallet_provider.sign_message(message)

        assert signature == MOCK_SIGNATURE_BYTES
        mock_encode.assert_called_once_with(message)
        mock_account.sign_message.assert_called_once_with("encoded_message")


def test_sign_message_failure(wallet_provider, mock_account):
    """Test sign_message method when signing fails."""
    message = "Hello, world!"
    error_message = "Signing failed"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.encode_defunct"
        ) as mock_encode,
        pytest.raises(Exception, match=error_message),
    ):
        mock_encode.return_value = "encoded_message"
        mock_account.sign_message.side_effect = Exception(error_message)

        wallet_provider.sign_message(message)


def test_sign_typed_data(wallet_provider, mock_account):
    """Test sign_typed_data method."""
    typed_data = {
        "types": {"EIP712Domain": []},
        "primaryType": "Test",
        "domain": {},
        "message": {},
    }

    signature = wallet_provider.sign_typed_data(typed_data)

    assert signature == MOCK_SIGNATURE_BYTES
    mock_account.sign_typed_data.assert_called_once_with(full_message=typed_data)


def test_sign_typed_data_failure(wallet_provider, mock_account):
    """Test sign_typed_data method when signing fails."""
    typed_data = {
        "types": {"EIP712Domain": []},
        "primaryType": "Test",
        "domain": {},
        "message": {},
    }
    error_message = "Signing failed"

    with pytest.raises(Exception, match=error_message):
        mock_account.sign_typed_data.side_effect = Exception(error_message)
        wallet_provider.sign_typed_data(typed_data)


def test_sign_transaction(wallet_provider, mock_account):
    """Test sign_transaction method."""
    transaction = {
        "to": MOCK_ADDRESS_TO,
        "value": MOCK_ONE_ETH_WEI,
        "gasPrice": MOCK_GAS_PRICE,
        "gas": MOCK_GAS_LIMIT,
        "nonce": 0,
        "chainId": MOCK_CHAIN_ID,
    }

    result = wallet_provider.sign_transaction(transaction)

    assert result is not None
    mock_account.sign_transaction.assert_called_once_with(transaction)


def test_sign_transaction_failure(wallet_provider, mock_account):
    """Test sign_transaction method when signing fails."""
    transaction = {
        "to": MOCK_ADDRESS_TO,
        "value": MOCK_ONE_ETH_WEI,
        "gasPrice": MOCK_GAS_PRICE,
        "gas": MOCK_GAS_LIMIT,
        "nonce": 0,
        "chainId": MOCK_CHAIN_ID,
    }
    error_message = "Signing failed"

    with pytest.raises(Exception, match=error_message):
        mock_account.sign_transaction.side_effect = Exception(error_message)
        wallet_provider.sign_transaction(transaction)
