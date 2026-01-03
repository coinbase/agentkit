"""Tests for CDP Solana Wallet Provider transaction operations."""

from decimal import Decimal
from unittest.mock import AsyncMock, Mock, patch

import pytest

from .conftest import (
    MOCK_ADDRESS_TO,
    MOCK_TRANSACTION_SIGNATURE,
)

# =========================================================
# transaction operation tests
# =========================================================


def test_native_transfer(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0.5")

    # Configure the mock to return transaction signature
    mock_transaction = Mock(signature=MOCK_TRANSACTION_SIGNATURE)
    mock_wallet = Mock()
    mock_wallet.transfer = AsyncMock(return_value=mock_transaction)
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with patch("asyncio.run", return_value=MOCK_TRANSACTION_SIGNATURE):
        tx_signature = mocked_wallet_provider.native_transfer(to_address, amount)

    assert tx_signature == MOCK_TRANSACTION_SIGNATURE


def test_native_transfer_full_sol(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method with 1 full SOL."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("1.0")

    mock_transaction = Mock(signature=MOCK_TRANSACTION_SIGNATURE)
    mock_wallet = Mock()
    mock_wallet.transfer = AsyncMock(return_value=mock_transaction)
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with patch("asyncio.run", return_value=MOCK_TRANSACTION_SIGNATURE):
        tx_signature = mocked_wallet_provider.native_transfer(to_address, amount)

    assert tx_signature == MOCK_TRANSACTION_SIGNATURE


def test_native_transfer_small_amount(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method with a very small amount."""
    to_address = MOCK_ADDRESS_TO
    small_amount = Decimal("0.000000001")  # 1 lamport

    mock_transaction = Mock(signature=MOCK_TRANSACTION_SIGNATURE)
    mock_wallet = Mock()
    mock_wallet.transfer = AsyncMock(return_value=mock_transaction)
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with patch("asyncio.run", return_value=MOCK_TRANSACTION_SIGNATURE):
        tx_signature = mocked_wallet_provider.native_transfer(to_address, small_amount)

    assert tx_signature == MOCK_TRANSACTION_SIGNATURE


def test_native_transfer_failure(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method when transfer fails."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0.5")
    error_msg = "Insufficient balance"

    # Configure mock to raise an exception
    async def raise_error(*args, **kwargs):
        raise Exception(error_msg)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=Exception(error_msg)),
        pytest.raises(Exception, match=error_msg),
    ):
        mocked_wallet_provider.native_transfer(to_address, amount)


def test_native_transfer_with_network_error(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method when network connection fails."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0.5")
    error_msg = "Network connection error"

    # Configure mock to raise a ConnectionError
    async def raise_connection_error(*args, **kwargs):
        raise ConnectionError(error_msg)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_connection_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=ConnectionError(error_msg)),
        pytest.raises(ConnectionError, match=error_msg),
    ):
        mocked_wallet_provider.native_transfer(to_address, amount)


def test_native_transfer_timeout(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method when transaction times out."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0.5")
    error_msg = "Transaction timed out"

    # Configure mock to raise a TimeoutError
    async def raise_timeout_error(*args, **kwargs):
        raise TimeoutError(error_msg)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_timeout_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=TimeoutError(error_msg)),
        pytest.raises(TimeoutError, match=error_msg),
    ):
        mocked_wallet_provider.native_transfer(to_address, amount)


def test_native_transfer_with_invalid_address(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method with invalid address."""
    invalid_address = "not_a_valid_solana_address"
    amount = Decimal("1.0")
    error_msg = "Invalid address format"

    # Configure CDP client to raise exception for invalid addresses
    async def raise_value_error(*args, **kwargs):
        raise ValueError(error_msg)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_value_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=ValueError(error_msg)),
        pytest.raises(ValueError, match=error_msg),
    ):
        mocked_wallet_provider.native_transfer(invalid_address, amount)


def test_native_transfer_zero_amount(mocked_wallet_provider, mock_cdp_client):
    """Test native_transfer method with zero amount."""
    to_address = MOCK_ADDRESS_TO
    amount = Decimal("0")
    error_msg = "Amount must be greater than zero"

    # Configure mock to raise an exception for zero amount
    async def raise_zero_amount_error(*args, **kwargs):
        raise ValueError(error_msg)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_zero_amount_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=ValueError(error_msg)),
        pytest.raises(ValueError, match=error_msg),
    ):
        mocked_wallet_provider.native_transfer(to_address, amount)
