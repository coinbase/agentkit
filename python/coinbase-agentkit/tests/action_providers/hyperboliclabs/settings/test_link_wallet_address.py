"""Tests for link_wallet_address action in HyperbolicSettingsActionProvider."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.settings.types import WalletLinkResponse

VALID_ETH_ADDRESS = "0x123456789abcdef"


def test_link_wallet_address_success(provider):
    """Test successful wallet address linking."""
    mock_response = WalletLinkResponse(success=True, message="Wallet address linked successfully")

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.settings, "link_wallet", return_value=mock_response),
    ):
        result = provider.link_wallet_address({"address": VALID_ETH_ADDRESS})

        assert '"success": true' in result
        assert '"message": "Wallet address linked successfully"' in result
        assert f"wallet_address: {VALID_ETH_ADDRESS}" in result

        assert "Next Steps:" in result
        assert "1. Your wallet has been successfully linked to your Hyperbolic account" in result
        assert "2. To add funds, send any of these tokens on Base Mainnet:" in result
        assert "- USDC" in result
        assert "- USDT" in result
        assert "- DAI" in result
        assert (
            "3. Send to this Hyperbolic address: 0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60"
            in result
        )


def test_link_wallet_address_api_error(provider):
    """Test wallet address linking with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.settings, "link_wallet", side_effect=Exception("API Error")),
    ):
        result = provider.link_wallet_address({"address": VALID_ETH_ADDRESS})
        assert "Error: Wallet linking: API Error" in result


def test_link_wallet_address_missing_address(provider):
    """Test wallet address linking with missing address."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
    ):
        with pytest.raises(Exception) as exc_info:
            provider.link_wallet_address({})
        assert "Field required" in str(exc_info.value)


def test_link_wallet_address_empty_address(provider):
    """Test wallet address linking with empty address."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
    ):
        result = provider.link_wallet_address({"address": ""})
        assert "Error" in result
