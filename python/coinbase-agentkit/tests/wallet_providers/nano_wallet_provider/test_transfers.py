"""Tests for Nano Wallet Provider transfers and signing."""

import pytest

from .conftest import MOCK_TO, MOCK_TX_HASH


def test_native_transfer(wallet_provider):
    """Test native_transfer method."""
    amount = 1.5
    # The RPC's `process` returns a hash
    wallet_provider._rpc.return_value = {"hash": MOCK_TX_HASH}
    result = wallet_provider.native_transfer(MOCK_TO, amount)
    assert result == MOCK_TX_HASH
    wallet_provider._rpc.assert_called_once()
    call_args = wallet_provider._rpc.call_args
    assert call_args.args[0] == "process"


def test_native_transfer_error(wallet_provider):
    """Test native_transfer when the RPC process fails."""
    wallet_provider._rpc.side_effect = RuntimeError(
        "Nano RPC error for action 'process': insufficient balance"
    )
    with pytest.raises(RuntimeError, match="insufficient balance"):
        wallet_provider.native_transfer(MOCK_TO, 1.0)


def test_sign_message(wallet_provider):
    """Test sign_message returns a deterministic signature."""
    sig = wallet_provider.sign_message("test-payload")
    assert isinstance(sig, str)
    assert sig.startswith("nano_sig:")
    assert str(len("test-payload")) in sig


def test_sign_empty_message(wallet_provider):
    """Test sign_message with an empty message."""
    sig = wallet_provider.sign_message("")
    assert sig.startswith("nano_sig:")


def test_sign_bytes_message(wallet_provider):
    """Test sign_message with bytes input."""
    sig = wallet_provider.sign_message("bytes")
    assert isinstance(sig, str)
