"""Tests for CDP Wallet Provider signing operations."""

from unittest.mock import patch

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


def test_sign_message(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method."""
    message = "Hello, world!"

    # Patch the sign_message method to return MOCK_SIGNATURE
    with patch.object(mocked_wallet_provider, "sign_message", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_message(message)
        assert signature == MOCK_SIGNATURE


def test_sign_message_binary(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method with binary data."""
    binary_message = b"Binary data"

    # Patch the sign_message method to return MOCK_SIGNATURE
    with patch.object(mocked_wallet_provider, "sign_message", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_message(binary_message)
        assert signature == MOCK_SIGNATURE


def test_sign_message_failure(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method when signing fails."""
    message = "Hello, world!"

    error_msg = "Signing failed"
    # Patch the sign_message method to raise an exception
    with (
        patch.object(mocked_wallet_provider, "sign_message", side_effect=Exception(error_msg)),
        pytest.raises(Exception, match=error_msg),
    ):
        mocked_wallet_provider.sign_message(message)


def test_sign_typed_data(mocked_wallet_provider, mock_cdp_client):
    """Test sign_typed_data method."""
    typed_data = {
        "types": {"EIP712Domain": []},
        "primaryType": "Test",
        "domain": {},
        "message": {},
    }

    # Patch the sign_typed_data method to return MOCK_SIGNATURE
    with patch.object(mocked_wallet_provider, "sign_typed_data", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_typed_data(typed_data)
        assert signature == MOCK_SIGNATURE


def test_sign_typed_data_failure(mocked_wallet_provider, mock_cdp_client):
    """Test sign_typed_data method when signing fails."""
    typed_data = {
        "types": {"EIP712Domain": []},
        "primaryType": "Test",
        "domain": {},
        "message": {},
    }

    error_msg = "Signing failed"
    # Patch the sign_typed_data method to raise an exception
    with (
        patch.object(mocked_wallet_provider, "sign_typed_data", side_effect=Exception(error_msg)),
        pytest.raises(Exception, match=error_msg),
    ):
        mocked_wallet_provider.sign_typed_data(typed_data)


def test_sign_transaction(mocked_wallet_provider, mock_cdp_client):
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

    # Patch the sign_transaction method to return MOCK_SIGNATURE
    with patch.object(mocked_wallet_provider, "sign_transaction", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_transaction(transaction)
        assert signature == MOCK_SIGNATURE


def test_sign_transaction_failure(mocked_wallet_provider, mock_cdp_client):
    """Test sign_transaction method when signing fails."""
    transaction = {
        "to": MOCK_ADDRESS_TO,
        "value": MOCK_ONE_ETH_WEI,
        "data": "0x",
    }

    error_msg = "Signing failed"
    # Patch the sign_transaction method to raise an exception
    with (
        patch.object(mocked_wallet_provider, "sign_transaction", side_effect=Exception(error_msg)),
        pytest.raises(Exception, match=error_msg),
    ):
        mocked_wallet_provider.sign_transaction(transaction)
