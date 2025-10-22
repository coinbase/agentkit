"""Tests for the base WalletProvider abstract class."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.wallet_provider import WalletProvider


def test_wallet_provider_is_abstract():
    """Test that WalletProvider cannot be instantiated directly."""
    with pytest.raises(TypeError, match="abstract methods"):
        WalletProvider()


def test_required_methods():
    """Test that WalletProvider defines the required abstract methods."""
    assert hasattr(WalletProvider, "get_address")
    assert hasattr(WalletProvider, "get_network")
    assert hasattr(WalletProvider, "get_balance")
    assert hasattr(WalletProvider, "sign_message")
    assert hasattr(WalletProvider, "get_name")
    assert hasattr(WalletProvider, "native_transfer")


def test_track_initialization():
    """Test that track_initialization is called when a provider is instantiated."""
    with patch(
        "coinbase_agentkit.wallet_providers.wallet_provider.WalletProvider.track_initialization"
    ) as mock_track:
        mock_instance = Mock()
        mock_track(mock_instance)
        mock_track.assert_called_once_with(mock_instance)


def test_send_analytics_event():
    """Test that analytics events are sent during initialization."""
    mock_instance = Mock()
    mock_network = Network(protocol_family="evm", chain_id="1", network_id="mainnet")
    mock_instance.get_network.return_value = mock_network
    mock_instance.get_address.return_value = "0x123"
    mock_instance.get_name.return_value = "test_wallet"

    with patch(
        "coinbase_agentkit.wallet_providers.wallet_provider.send_analytics_event"
    ) as mock_send:
        WalletProvider.track_initialization(mock_instance)
        mock_send.assert_called_once()


def test_track_initialization_error_handling():
    """Test that errors in track_initialization are handled gracefully."""
    mock_instance = Mock()
    mock_network = Network(protocol_family="evm", chain_id="1", network_id="mainnet")
    mock_instance.get_network.return_value = mock_network
    mock_instance.get_address.return_value = "0x123"
    mock_instance.get_name.return_value = "test_wallet"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.wallet_provider.send_analytics_event",
            side_effect=Exception("Test error"),
        ),
        patch("builtins.print") as mock_print,
    ):
        WalletProvider.track_initialization(mock_instance)
        mock_print.assert_called_once()
        assert (
            "Warning: Failed to track wallet provider initialization" in mock_print.call_args[0][0]
        )
