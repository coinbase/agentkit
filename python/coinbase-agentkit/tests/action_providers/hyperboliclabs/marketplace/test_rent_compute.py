"""Tests for rent_compute action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)

# Test constants
MOCK_INSTANCE_ID = "test-instance-123"
MOCK_CLUSTER = "us-east-1"
MOCK_NODE = "node-456"
MOCK_GPU_COUNT = "2"


@pytest.fixture
def mock_api_response():
    """Mock API response for compute rental."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "status": "success",
        "instance": {
            "id": "i-123456",
            "cluster": "us-east-1",
            "node": "node-789",
            "gpu_count": 2,
            "status": "starting",
        },
    }
    return mock_response


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


def test_rent_compute_success(provider, mock_api_response):
    """Test successful compute rental."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_api_response),
    ):
        result = provider.rent_compute(
            {"cluster_name": "us-east-1", "node_name": "node-789", "gpu_count": "2"}
        )

        # Check success response
        assert '"status": "success"' in result
        assert '"id": "i-123456"' in result
        assert '"cluster": "us-east-1"' in result
        assert '"node": "node-789"' in result
        assert '"gpu_count": 2' in result
        assert '"status": "starting"' in result

        # Check next steps
        assert "Next Steps:" in result
        assert "1. Your GPU instance is being provisioned" in result
        assert "2. Use get_gpu_status to check when it's ready" in result
        assert "3. Once status is 'running', you can:" in result
        assert "- Connect via SSH using the provided command" in result
        assert "- Run commands using remote_shell" in result
        assert "- Install packages and set up your environment" in result


def test_rent_compute_api_error(provider):
    """Test compute rental with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", side_effect=Exception("API Error")),
    ):
        result = provider.rent_compute(
            {"cluster_name": "us-east-1", "node_name": "node-789", "gpu_count": "2"}
        )
        assert "Error renting compute: API Error" in result


def test_rent_compute_invalid_response(provider):
    """Test compute rental with invalid response format."""
    mock_response = Mock()
    mock_response.json.return_value = {"invalid": "response"}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_response),
    ):
        result = provider.rent_compute(
            {"cluster_name": "us-east-1", "node_name": "node-789", "gpu_count": "2"}
        )
        # Should still format the response and add next steps
        assert '"invalid": "response"' in result
        assert "Next Steps:" in result


def test_rent_compute_missing_fields(provider):
    """Test compute rental with missing required fields."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=Mock()),
    ):
        # Missing cluster_name
        with pytest.raises(ValidationError, match="Field required"):
            provider.rent_compute({"node_name": "node-789", "gpu_count": "2"})

        # Missing node_name
        with pytest.raises(ValidationError, match="Field required"):
            provider.rent_compute({"cluster_name": "us-east-1", "gpu_count": "2"})

        # Missing gpu_count
        with pytest.raises(ValidationError, match="Field required"):
            provider.rent_compute({"cluster_name": "us-east-1", "node_name": "node-789"})
