"""Tests for CDP Wallet Provider trading operations."""

from unittest.mock import Mock

import pytest

from .conftest import MOCK_TRANSACTION_HASH

# =========================================================
# trading operations
# =========================================================


def test_trade(mocked_wallet_provider, mock_wallet):
    """Test trade method."""
    amount = "1.0"
    from_asset_id = "eth"
    to_asset_id = "usdc"

    result = mocked_wallet_provider.trade(amount, from_asset_id, to_asset_id)

    assert "Traded 1.0 of eth for 0.5 of usdc" in result
    assert f"Transaction hash for the trade: {MOCK_TRANSACTION_HASH}" in result
    mock_wallet.trade.assert_called_once_with(
        amount=amount, from_asset_id=from_asset_id, to_asset_id=to_asset_id
    )


def test_trade_state_transitions(mocked_wallet_provider, mock_wallet):
    """Test trade method with state transitions between pending and completed."""
    amount = "1.0"
    from_asset_id = "eth"
    to_asset_id = "usdc"

    mock_trade = Mock()
    mock_trade.to_amount = "0.5"
    mock_trade.transaction = Mock()
    mock_trade.transaction.transaction_hash = MOCK_TRANSACTION_HASH
    mock_trade.transaction.transaction_link = f"https://example.com/tx/{MOCK_TRANSACTION_HASH}"

    mock_trade.status = "pending"

    def wait_side_effect(*args, **kwargs):
        mock_trade.status = "completed"
        return mock_trade

    mock_trade.wait = Mock(side_effect=wait_side_effect)
    mock_wallet.trade.return_value = mock_trade

    result = mocked_wallet_provider.trade(amount, from_asset_id, to_asset_id)

    assert "Traded 1.0 of eth for 0.5 of usdc" in result
    assert mock_trade.wait.called
    assert mock_trade.status == "completed"
    mock_wallet.trade.assert_called_once_with(
        amount=amount, from_asset_id=from_asset_id, to_asset_id=to_asset_id
    )


def test_trade_without_wallet(mocked_wallet_provider):
    """Test trade method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.trade("1.0", "eth", "usdc")


def test_trade_failure(mocked_wallet_provider, mock_wallet):
    """Test trade method when trade fails."""
    mock_wallet.trade.side_effect = Exception("Trade failed")

    with pytest.raises(Exception, match="Error trading assets"):
        mocked_wallet_provider.trade("1.0", "eth", "usdc")
