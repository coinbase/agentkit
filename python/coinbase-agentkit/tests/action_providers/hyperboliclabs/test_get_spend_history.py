"""Tests for get_spend_history action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)


@pytest.fixture
def mock_api_response():
    """Mock API response for spend history."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "instance_history": [
            {
                "instance_name": "instance-123",
                "started_at": "2024-01-15T12:00:00Z",
                "terminated_at": "2024-01-15T13:00:00Z",
                "gpu_count": 2,
                "hardware": {"gpus": [{"model": "NVIDIA A100", "count": 2}]},
                "price": {"amount": 2500},  # cents per hour
            },
            {
                "instance_name": "instance-456",
                "started_at": "2024-01-14T10:00:00Z",
                "terminated_at": "2024-01-14T12:00:00Z",
                "gpu_count": 1,
                "hardware": {"gpus": [{"model": "NVIDIA A100", "count": 1}]},
                "price": {"amount": 1250},  # cents per hour
            },
        ]
    }
    return mock_response


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


def test_get_spend_history_success(provider, mock_api_response):
    """Test successful get_spend_history action."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_api_response),
    ):
        result = provider.get_spend_history({})

        # Check header and sections
        assert "=== GPU Rental Spending Analysis ===" in result
        assert "Instance Rentals:" in result

        # Check first instance details
        assert "- instance-123:" in result
        assert "GPU: NVIDIA A100 (Count: 2)" in result
        assert "Duration: 3600 seconds" in result
        assert "Cost: $25.00" in result

        # Check second instance details
        assert "- instance-456:" in result
        assert "GPU: NVIDIA A100 (Count: 1)" in result
        assert "Duration: 7200 seconds" in result
        assert "Cost: $25.00" in result

        # Check GPU type breakdown
        assert "NVIDIA A100:" in result
        assert "Total Rentals: 3" in result  # 2 GPUs + 1 GPU
        assert "Total Time: 10800 seconds" in result
        assert "Total Cost: $50.00" in result


def test_get_spend_history_empty(provider):
    """Test get_spend_history action with no history."""
    mock_response = Mock()
    mock_response.json.return_value = {"instance_history": []}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.get_spend_history({})
        assert "No rental history found." in result


def test_get_spend_history_api_error(provider):
    """Test get_spend_history action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", side_effect=Exception("API Error")),
    ):
        result = provider.get_spend_history({})
        assert "Error retrieving spend history: API Error" in result


def test_get_spend_history_invalid_response(provider):
    """Test get_spend_history action with invalid response format."""
    mock_response = Mock()
    mock_response.json.return_value = {"invalid": "response"}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.get_spend_history({})
        assert "No rental history found." in result


def test_get_spend_history_malformed_instance(provider):
    """Test get_spend_history action with malformed instance data."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "instance_history": [
            {
                "instance_name": "instance-123",
                "started_at": "2024-01-15T12:00:00Z",
                "terminated_at": "2024-01-15T13:00:00Z",
                # Missing other fields, should use defaults
                "gpu_count": 0,
                "hardware": {},
                "price": {"amount": 0},
            }
        ]
    }

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.get_spend_history({})

        # Check that defaults are used
        assert "- instance-123:" in result
        assert "GPU: Unknown GPU" in result
        assert "Duration: 3600 seconds" in result
        assert "Cost: $0.00" in result
