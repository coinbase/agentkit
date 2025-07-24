"""Tests for CDP Solana Wallet Provider wallet management operations."""

import contextlib
import os
from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider import (
    CdpSolanaWalletProvider,
    CdpSolanaWalletProviderConfig,
)

from .conftest import MOCK_API_KEY_ID, MOCK_API_KEY_SECRET, MOCK_WALLET_SECRET

# =========================================================
# wallet management tests
# =========================================================


def test_get_client(mocked_wallet_provider):
    """Test get_client method."""
    # Verify the wallet provider has the correct credentials
    assert mocked_wallet_provider._api_key_id == MOCK_API_KEY_ID
    assert mocked_wallet_provider._api_key_secret == MOCK_API_KEY_SECRET
    assert mocked_wallet_provider._wallet_secret == MOCK_WALLET_SECRET

    # Get client and verify it's properly configured
    client = mocked_wallet_provider.get_client()
    assert client is not None
    assert hasattr(client, "api_key_id")
    assert hasattr(client, "api_key_secret")
    assert hasattr(client, "wallet_secret")


def test_get_client_creates_new_instance(mocked_wallet_provider):
    """Test that get_client creates a new instance each time."""
    # Mock the CdpClient to return different instances
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.CdpClient"
    ) as mock_client:
        # Configure side_effect to return a new mock each time
        mock_client.side_effect = lambda **kwargs: Mock(
            api_key_id=kwargs.get("api_key_id"),
            api_key_secret=kwargs.get("api_key_secret"),
            wallet_secret=kwargs.get("wallet_secret"),
        )

        client1 = mocked_wallet_provider.get_client()
        client2 = mocked_wallet_provider.get_client()

        # Each call should create a new client instance
        assert client1 is not client2


def test_run_async_with_existing_loop(mocked_wallet_provider):
    """Test _run_async method with existing event loop."""
    import asyncio

    async def test_coroutine():
        return "test_result"

    # Create an event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = mocked_wallet_provider._run_async(test_coroutine())
        assert result == "test_result"
    finally:
        loop.close()


def test_run_async_without_existing_loop(mocked_wallet_provider):
    """Test _run_async method without existing event loop."""
    import asyncio

    async def test_coroutine():
        return "test_result_no_loop"

    # Ensure no event loop is set
    with contextlib.suppress(Exception):
        asyncio.set_event_loop(None)

    result = mocked_wallet_provider._run_async(test_coroutine())
    assert result == "test_result_no_loop"


def test_run_async_with_exception(mocked_wallet_provider):
    """Test _run_async method when coroutine raises exception."""

    async def failing_coroutine():
        raise ValueError("Test exception")

    with pytest.raises(ValueError, match="Test exception"):
        mocked_wallet_provider._run_async(failing_coroutine())


def test_wallet_provider_attributes(mocked_wallet_provider):
    """Test that wallet provider has all required attributes."""
    # Check that all required attributes are present
    assert hasattr(mocked_wallet_provider, "_api_key_id")
    assert hasattr(mocked_wallet_provider, "_api_key_secret")
    assert hasattr(mocked_wallet_provider, "_wallet_secret")
    assert hasattr(mocked_wallet_provider, "_network")
    assert hasattr(mocked_wallet_provider, "_connection")
    assert hasattr(mocked_wallet_provider, "_address")

    # Verify network configuration
    network = mocked_wallet_provider._network
    assert network.protocol_family == "svm"
    assert network.chain_id is None  # Solana doesn't use chain IDs


def test_wallet_provider_methods(mocked_wallet_provider):
    """Test that wallet provider has all required methods."""
    # Check that all required methods are present
    required_methods = [
        "get_address",
        "get_balance",
        "get_name",
        "get_network",
        "native_transfer",
        "sign_message",
        "get_client",
        "_run_async",
    ]

    for method_name in required_methods:
        assert hasattr(mocked_wallet_provider, method_name)
        assert callable(getattr(mocked_wallet_provider, method_name))


def test_get_client_with_missing_credentials():
    """Test get_client method with missing credentials."""
    with patch.dict(os.environ, {}, clear=True):
        config = CdpSolanaWalletProviderConfig()

        with pytest.raises(ValueError, match="Missing required environment variables"):
            CdpSolanaWalletProvider(config)
