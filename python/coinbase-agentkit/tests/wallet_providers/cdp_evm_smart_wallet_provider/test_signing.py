"""Tests for CDP EVM Smart Wallet Provider signing operations."""

from unittest.mock import AsyncMock, MagicMock

import pytest

# =========================================================
# signing tests
# =========================================================


def test_sign_message(mocked_wallet_provider):
    """Test sign_message method raises NotImplementedError."""
    with pytest.raises(NotImplementedError, match="Smart wallets cannot sign messages directly"):
        mocked_wallet_provider.sign_message("Hello, world!")


def test_sign_typed_data(mocked_wallet_provider):
    """Test sign_typed_data method properly calls through to smart account."""
    # Setup test data
    typed_data = {
        "domain": {"name": "Test Domain"},
        "types": {"Person": [{"name": "name", "type": "string"}]},
        "primaryType": "Person",
        "message": {"name": "Alice"},
    }

    # Create a mock result with signature
    mock_result = MagicMock()
    mock_result.signature = "0xmocked_signature"

    # Setup mock for _run_async to return our mock result
    def mock_run_async(coroutine):
        if "close" not in str(coroutine):  # Don't return signature for close() calls
            return mock_result

    mocked_wallet_provider._run_async = MagicMock(side_effect=mock_run_async)

    # Setup mock CDP client
    mock_cdp = AsyncMock()
    mocked_wallet_provider.get_client = MagicMock(return_value=mock_cdp)
    mocked_wallet_provider.get_network = MagicMock(
        return_value=MagicMock(network_id="test-network")
    )

    # Call the method
    result = mocked_wallet_provider.sign_typed_data(typed_data)

    # Verify the result
    assert result == "0xmocked_signature"

    # Verify _run_async was called
    assert mocked_wallet_provider._run_async.call_count >= 1


def test_sign_transaction(mocked_wallet_provider):
    """Test sign_transaction method raises NotImplementedError."""
    with pytest.raises(
        NotImplementedError, match="Smart wallets cannot sign transactions directly"
    ):
        mocked_wallet_provider.sign_transaction({})
