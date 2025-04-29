"""Tests for CDP Wallet Provider wallet management operations."""

from unittest.mock import Mock

import pytest
from cdp import WalletData

# =========================================================
# wallet management
# =========================================================


def test_export_wallet(mocked_wallet_provider, mock_wallet):
    """Test export_wallet method."""
    mock_wallet_data = Mock(spec=WalletData)
    mock_wallet.export_data.return_value = mock_wallet_data

    result = mocked_wallet_provider.export_wallet()

    assert result == mock_wallet_data
    mock_wallet.export_data.assert_called_once()


def test_export_wallet_without_wallet(mocked_wallet_provider):
    """Test export_wallet method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.export_wallet()


def test_export_wallet_failure(mocked_wallet_provider, mock_wallet):
    """Test export_wallet method when export fails."""
    mock_wallet.export_data.side_effect = Exception("Export failed")

    with pytest.raises(Exception, match="Export failed"):
        mocked_wallet_provider.export_wallet()
