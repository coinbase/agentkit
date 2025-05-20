"""Tests for CDP EVM Smart Wallet Provider signing operations."""

import pytest

# =========================================================
# signing tests
# =========================================================


def test_sign_message(mocked_wallet_provider):
    """Test sign_message method raises NotImplementedError."""
    with pytest.raises(NotImplementedError, match="Smart wallets cannot sign messages directly"):
        mocked_wallet_provider.sign_message("Hello, world!")


def test_sign_typed_data(mocked_wallet_provider):
    """Test sign_typed_data method raises NotImplementedError."""
    with pytest.raises(NotImplementedError, match="Smart wallets cannot sign typed data directly"):
        mocked_wallet_provider.sign_typed_data({})


def test_sign_transaction(mocked_wallet_provider):
    """Test sign_transaction method raises NotImplementedError."""
    with pytest.raises(
        NotImplementedError, match="Smart wallets cannot sign transactions directly"
    ):
        mocked_wallet_provider.sign_transaction({})
