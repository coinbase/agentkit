"""Tests for terminate_compute action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)


@pytest.fixture
def mock_api_response():
    """Mock API response for compute termination."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "status": "success",
        "message": "Instance terminated successfully",
    }
    return mock_response


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


def test_terminate_compute_success(provider, mock_api_response):
    """Test successful compute termination."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_api_response),
    ):
        result = provider.terminate_compute({"instance_id": "i-123456"})

        # Check success response
        assert '"status": "success"' in result
        assert '"message": "Instance terminated successfully"' in result

        # Check next steps
        assert "Next Steps:" in result
        assert "1. Your GPU instance has been terminated" in result
        assert "2. Any active SSH connections have been closed" in result
        assert "3. You can check your spend history with get_spend_history" in result
        assert "4. To rent a new instance, use get_available_gpus and rent_compute" in result


def test_terminate_compute_api_error(provider):
    """Test compute termination with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", side_effect=Exception("API Error")),
    ):
        result = provider.terminate_compute({"instance_id": "i-123456"})
        assert "Error terminating compute: API Error" in result


def test_terminate_compute_invalid_response(provider):
    """Test compute termination with invalid response format."""
    mock_response = Mock()
    mock_response.json.return_value = {"invalid": "response"}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_response),
    ):
        result = provider.terminate_compute({"instance_id": "i-123456"})
        # Should still format the response and add next steps
        assert '"invalid": "response"' in result
        assert "Next Steps:" in result


def test_terminate_compute_missing_instance_id(provider):
    """Test compute termination with missing instance ID."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=Mock()),
    ):
        with pytest.raises(Exception) as exc_info:
            provider.terminate_compute({})
        assert "Field required" in str(exc_info.value)
