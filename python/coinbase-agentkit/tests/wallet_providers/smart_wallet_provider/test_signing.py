"""Tests for Smart Wallet Provider signing operations."""

import pytest

# =========================================================
# signing tests
# =========================================================


def test_sign_message(wallet_provider):
    """Test sign_message method raises NotImplementedError."""
    with pytest.raises(
        NotImplementedError, match="Smart wallets do not support signing raw messages"
    ):
        wallet_provider.sign_message("Hello, world!")


def test_sign_typed_data(wallet_provider):
    """Test sign_typed_data method raises NotImplementedError."""
    with pytest.raises(
        NotImplementedError, match="Smart wallets do not support signing typed data"
    ):
        wallet_provider.sign_typed_data({})


def test_sign_transaction(wallet_provider):
    """Test sign_transaction method raises NotImplementedError."""
    with pytest.raises(
        NotImplementedError, match="Smart wallets do not support signing transactions"
    ):
        wallet_provider.sign_transaction({})
