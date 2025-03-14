"""Tests for terminate_compute action in HyperbolicMarketplaceActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    TerminateInstanceResponse,
)


def test_terminate_compute_success(provider):
    """Test successful compute termination."""
    mock_response = TerminateInstanceResponse(
        status="success", message="Instance terminated successfully"
    )

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "terminate_instance", return_value=mock_response),
    ):
        result = provider.terminate_compute({"id": "i-123456"})

        assert '"status": "success"' in result
        assert '"message": "Instance terminated successfully"' in result

        assert "Next Steps:" in result
        assert "1. Your GPU instance has been terminated" in result
        assert "2. Any active SSH connections have been closed" in result
        assert "3. You can check your spend history with get_spend_history" in result
        assert "4. To rent a new instance, use get_available_gpus and rent_compute" in result


def test_terminate_compute_api_error(provider):
    """Test compute termination with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace, "terminate_instance", side_effect=Exception("API Error")
        ),
    ):
        result = provider.terminate_compute({"id": "i-123456"})
        assert "Error: Compute termination: API Error" in result


def test_terminate_compute_missing_instance_id(provider):
    """Test compute termination with missing instance ID."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=Mock()),
    ):
        with pytest.raises(Exception) as exc_info:
            provider.terminate_compute({})
        assert "Field required" in str(exc_info.value)
