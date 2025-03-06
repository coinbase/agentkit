"""Tests for get_current_balance action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)


@pytest.fixture
def mock_balance_response():
    """Mock API response for balance info."""
    mock_response = Mock()
    mock_response.json.return_value = {"credits": 15000}  # In cents
    return mock_response


@pytest.fixture
def mock_history_response():
    """Mock API response for purchase history."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "purchase_history": [
            {
                "amount": 10000,  # $100.00
                "timestamp": "2024-01-15T12:00:00+00:00",
            },
            {
                "amount": 5000,  # $50.00
                "timestamp": "2023-12-30T15:30:00+00:00",
            },
        ]
    }
    return mock_response


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


def test_get_current_balance_success(provider, mock_balance_response, mock_history_response):
    """Test successful get_current_balance action."""
    mock_get = Mock()
    mock_get.side_effect = [mock_balance_response, mock_history_response]

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", mock_get),
    ):
        result = provider.get_current_balance({})

        # Check the response formatting
        assert "Your current Hyperbolic platform balance is $150.00" in result
        assert "Purchase History:" in result
        assert "$100.00 on January 15, 2024" in result
        assert "$50.00 on December 30, 2023" in result


def test_get_current_balance_empty_history(provider):
    """Test get_current_balance action with empty purchase history."""
    mock_balance = Mock()
    mock_balance.json.return_value = {"credits": 0}

    mock_history = Mock()
    mock_history.json.return_value = {"purchase_history": []}

    mock_get = Mock()
    mock_get.side_effect = [mock_balance, mock_history]

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", mock_get),
    ):
        result = provider.get_current_balance({})
        assert "Your current Hyperbolic platform balance is $0.00" in result
        assert "No previous purchases found" in result


def test_get_current_balance_api_error(provider):
    """Test get_current_balance action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", side_effect=Exception("API Error")),
    ):
        result = provider.get_current_balance({})
        assert "Error retrieving balance information: API Error" in result
