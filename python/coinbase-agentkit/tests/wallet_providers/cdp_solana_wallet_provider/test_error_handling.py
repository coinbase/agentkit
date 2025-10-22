"""Tests for CDP Solana Wallet Provider error handling."""

from decimal import Decimal
from unittest.mock import AsyncMock, Mock, patch

import pytest

# =========================================================
# error handling tests
# =========================================================


def test_network_error_handling(mocked_wallet_provider, mock_cdp_client):
    """Test handling of network errors during transactions."""
    # Test native transfer with network error
    error_msg = "Network connection error"

    async def raise_connection_error(*args, **kwargs):
        raise ConnectionError(error_msg)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_connection_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=ConnectionError(error_msg)),
        pytest.raises(ConnectionError, match=error_msg),
    ):
        mocked_wallet_provider.native_transfer("SomeAddress", Decimal("0.5"))

    # Test sign message with network error
    mock_cdp_client.solana.sign_message = raise_connection_error

    with (
        patch("asyncio.run", side_effect=ConnectionError(error_msg)),
        pytest.raises(ConnectionError, match=error_msg),
    ):
        mocked_wallet_provider.sign_message("test message")


def test_comprehensive_error_handling(mocked_wallet_provider, mock_cdp_client, mock_solana_client):
    """Test comprehensive error handling for various scenarios."""
    # Test invalid address error in transfer
    address_error = "Invalid address format"

    async def raise_value_error(*args, **kwargs):
        raise ValueError(address_error)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_value_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=ValueError(address_error)),
        pytest.raises(ValueError, match=address_error),
    ):
        mocked_wallet_provider.native_transfer("invalid_address", Decimal("1.0"))

    # Test RPC connection error for balance
    rpc_error = "RPC connection failed"
    mock_solana_client.return_value.get_balance.side_effect = Exception(rpc_error)

    with pytest.raises(Exception, match=rpc_error):
        mocked_wallet_provider.get_balance()


def test_cdp_client_errors(mocked_wallet_provider, mock_cdp_client):
    """Test error handling for CDP client specific errors."""
    # Test CDP authentication error
    auth_error = "Invalid API credentials"

    async def raise_auth_error(*args, **kwargs):
        raise Exception(auth_error)

    mock_cdp_client.solana.get_account = raise_auth_error

    with (
        patch("asyncio.run", side_effect=Exception(auth_error)),
        pytest.raises(Exception, match=auth_error),
    ):
        mocked_wallet_provider.native_transfer("SomeAddress", Decimal("1.0"))

    # Test CDP rate limit error
    rate_limit_error = "Rate limit exceeded"
    mock_cdp_client.solana.sign_message = AsyncMock(side_effect=Exception(rate_limit_error))

    with (
        patch("asyncio.run", side_effect=Exception(rate_limit_error)),
        pytest.raises(Exception, match=rate_limit_error),
    ):
        mocked_wallet_provider.sign_message("test")


def test_transaction_specific_errors(mocked_wallet_provider, mock_cdp_client):
    """Test transaction-specific error scenarios."""
    # Test insufficient balance error
    balance_error = "Insufficient SOL balance"

    async def raise_balance_error(*args, **kwargs):
        raise Exception(balance_error)

    mock_wallet = Mock()
    mock_wallet.transfer = raise_balance_error
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with (
        patch("asyncio.run", side_effect=Exception(balance_error)),
        pytest.raises(Exception, match=balance_error),
    ):
        mocked_wallet_provider.native_transfer("SomeAddress", Decimal("1000000"))

    # Test transaction confirmation timeout
    timeout_error = "Transaction confirmation timeout"

    async def raise_timeout(*args, **kwargs):
        raise TimeoutError(timeout_error)

    mock_wallet.transfer = raise_timeout

    with (
        patch("asyncio.run", side_effect=TimeoutError(timeout_error)),
        pytest.raises(TimeoutError, match=timeout_error),
    ):
        mocked_wallet_provider.native_transfer("SomeAddress", Decimal("1.0"))


def test_solana_rpc_errors(mocked_wallet_provider, mock_solana_client, mock_public_key):
    """Test Solana RPC specific errors."""
    # Test invalid public key error
    pubkey_error = "Invalid public key"
    mock_public_key.from_string.side_effect = ValueError(pubkey_error)

    with pytest.raises(ValueError, match=pubkey_error):
        mocked_wallet_provider.get_balance()

    # Reset the mock
    mock_public_key.from_string.side_effect = None
    mock_public_key.from_string.return_value = Mock()

    # Test RPC method not found
    rpc_method_error = "Method not found"
    mock_solana_client.return_value.get_balance.side_effect = Exception(rpc_method_error)

    with pytest.raises(Exception, match=rpc_method_error):
        mocked_wallet_provider.get_balance()
