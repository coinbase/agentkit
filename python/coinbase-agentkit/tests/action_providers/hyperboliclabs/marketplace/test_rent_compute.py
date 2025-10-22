"""Tests for rent_compute action in HyperbolicMarketplaceActionProvider."""

from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    RentInstanceResponse,
)

MOCK_INSTANCE_ID = "test-instance-123"
MOCK_CLUSTER = "us-east-1"
MOCK_NODE = "node-456"
MOCK_GPU_COUNT = "2"


def test_rent_compute_success(provider):
    """Test successful compute rental."""
    mock_response = RentInstanceResponse(status="success", instance_name="i-123456")

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "rent_instance", return_value=mock_response),
    ):
        result = provider.rent_compute(
            {"cluster_name": "us-east-1", "node_name": "node-789", "gpu_count": "2"}
        )

        assert '"status": "success"' in result
        assert '"instance_name": "i-123456"' in result

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
        patch.object(provider.marketplace, "rent_instance", side_effect=Exception("API Error")),
    ):
        result = provider.rent_compute(
            {"cluster_name": "us-east-1", "node_name": "node-789", "gpu_count": "2"}
        )
        assert "Error: Compute rental: API Error" in result


def test_rent_compute_missing_fields(provider):
    """Test compute rental with missing required fields."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=Mock()),
    ):
        with pytest.raises(ValidationError, match="Field required"):
            provider.rent_compute({"node_name": "node-789", "gpu_count": "2"})

        with pytest.raises(ValidationError, match="Field required"):
            provider.rent_compute({"cluster_name": "us-east-1", "gpu_count": "2"})

        with pytest.raises(ValidationError, match="Field required"):
            provider.rent_compute({"cluster_name": "us-east-1", "node_name": "node-789"})
