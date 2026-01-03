"""Tests for CDP Solana Wallet Provider signing operations."""

from unittest.mock import AsyncMock, patch

import pytest

from .conftest import MOCK_SIGNATURE

# =========================================================
# signing operation tests
# =========================================================


def test_sign_message(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method."""
    message = "Hello, Solana!"

    # Configure the mock to return signature
    mock_cdp_client.solana.sign_message = AsyncMock(return_value=MOCK_SIGNATURE)

    with patch("asyncio.run", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_message(message)

    assert signature == MOCK_SIGNATURE


def test_sign_message_binary(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method with binary data."""
    binary_message = b"Binary data for signing"

    # Configure the mock to return signature
    mock_cdp_client.solana.sign_message = AsyncMock(return_value=MOCK_SIGNATURE)

    with patch("asyncio.run", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_message(binary_message)

    assert signature == MOCK_SIGNATURE


def test_sign_message_empty(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method with empty message."""
    message = ""

    # Configure the mock to return signature
    mock_cdp_client.solana.sign_message = AsyncMock(return_value=MOCK_SIGNATURE)

    with patch("asyncio.run", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_message(message)

    assert signature == MOCK_SIGNATURE


def test_sign_message_long(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method with long message."""
    message = "A" * 1000  # 1000 character message

    # Configure the mock to return signature
    mock_cdp_client.solana.sign_message = AsyncMock(return_value=MOCK_SIGNATURE)

    with patch("asyncio.run", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_message(message)

    assert signature == MOCK_SIGNATURE


def test_sign_message_failure(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method when signing fails."""
    message = "Hello, Solana!"
    error_msg = "Signing failed"

    # Configure mock to raise an exception
    async def raise_error(*args, **kwargs):
        raise Exception(error_msg)

    mock_cdp_client.solana.sign_message = raise_error

    with (
        patch("asyncio.run", side_effect=Exception(error_msg)),
        pytest.raises(Exception, match=error_msg),
    ):
        mocked_wallet_provider.sign_message(message)


def test_sign_message_with_network_error(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method with network error."""
    message = "Hello, Solana!"
    error_msg = "Network connection error"

    # Configure mock to raise a ConnectionError
    async def raise_connection_error(*args, **kwargs):
        raise ConnectionError(error_msg)

    mock_cdp_client.solana.sign_message = raise_connection_error

    with (
        patch("asyncio.run", side_effect=ConnectionError(error_msg)),
        pytest.raises(ConnectionError, match=error_msg),
    ):
        mocked_wallet_provider.sign_message(message)


def test_sign_message_timeout(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method when signing times out."""
    message = "Hello, Solana!"
    error_msg = "Signing operation timed out"

    # Configure mock to raise a TimeoutError
    async def raise_timeout_error(*args, **kwargs):
        raise TimeoutError(error_msg)

    mock_cdp_client.solana.sign_message = raise_timeout_error

    with (
        patch("asyncio.run", side_effect=TimeoutError(error_msg)),
        pytest.raises(TimeoutError, match=error_msg),
    ):
        mocked_wallet_provider.sign_message(message)


def test_sign_message_with_unicode(mocked_wallet_provider, mock_cdp_client):
    """Test sign_message method with unicode characters."""
    message = "Hello, 世界! 🌍"

    # Configure the mock to return signature
    mock_cdp_client.solana.sign_message = AsyncMock(return_value=MOCK_SIGNATURE)

    with patch("asyncio.run", return_value=MOCK_SIGNATURE):
        signature = mocked_wallet_provider.sign_message(message)

    assert signature == MOCK_SIGNATURE
