"""Tests for link_wallet_address action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)

# Test constants
TEST_WALLET = "0x123456789"


@pytest.fixture
def mock_api_response():
    """Mock API response for wallet linking."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "status": "success",
        "message": "Wallet address linked successfully",
    }
    return mock_response


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


def test_link_wallet_address_success(provider, mock_api_response):
    """Test successful wallet address linking."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_api_response),
    ):
        result = provider.link_wallet_address({"wallet_address": "0x123456789abcdef"})

        # Check success response
        assert '"status": "success"' in result
        assert '"message": "Wallet address linked successfully"' in result

        # Check next steps
        assert "Next Steps:" in result
        assert "1. Your wallet has been successfully linked" in result
        assert "2. To add funds, send any of these tokens on Base network:" in result
        assert "- USDC" in result
        assert "- USDT" in result
        assert "- DAI" in result
        assert "3. Send to this Hyperbolic address:" in result
        assert "0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60" in result


def test_link_wallet_address_api_error(provider):
    """Test wallet address linking with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", side_effect=Exception("API Error")),
    ):
        result = provider.link_wallet_address({"wallet_address": "0x123456789abcdef"})
        assert "Error linking wallet address: API Error" in result


def test_link_wallet_address_invalid_response(provider):
    """Test wallet address linking with invalid response format."""
    mock_response = Mock()
    mock_response.json.return_value = {"invalid": "response"}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_response),
    ):
        result = provider.link_wallet_address({"wallet_address": "0x123456789abcdef"})
        # Should still format the response and add next steps
        assert '"invalid": "response"' in result
        assert "Next Steps:" in result


def test_link_wallet_address_missing_address(provider):
    """Test wallet address linking with missing address."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=Mock()),
    ):
        with pytest.raises(Exception) as exc_info:
            provider.link_wallet_address({})
        assert "Field required" in str(exc_info.value)


def test_link_wallet_address_empty_address(provider):
    """Test wallet address linking with empty address."""
    with pytest.raises(Exception) as exc_info:
        provider.link_wallet_address({"wallet_address": ""})
    assert "length" in str(exc_info.value).lower() or "at least" in str(exc_info.value).lower()
