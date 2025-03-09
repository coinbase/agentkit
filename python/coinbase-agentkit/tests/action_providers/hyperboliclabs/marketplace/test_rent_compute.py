"""Tests for rent_compute action in HyperbolicMarketplaceActionProvider."""

from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    MarketplaceActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.models import (
    RentInstanceResponse,
)

# Test constants
MOCK_INSTANCE_ID = "test-instance-123"
MOCK_CLUSTER = "us-east-1"
MOCK_NODE = "node-456"
MOCK_GPU_COUNT = "2"


@pytest.fixture
def provider(mock_api_key):
    """Create HyperbolicMarketplaceActionProvider instance with test API key."""
    return MarketplaceActionProvider(api_key=mock_api_key)


def test_rent_compute_success(provider):
    """Test successful compute rental."""
    # Create a proper RentInstanceResponse object
    mock_response = RentInstanceResponse(status="success", instance_name="i-123456")

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "rent_instance", return_value=mock_response),
    ):
        result = provider.rent_compute(
            {"cluster_name": "us-east-1", "node_name": "node-789", "gpu_count": "2"}
        )

        # Check success response
        assert '"status": "success"' in result
        assert '"instance_name": "i-123456"' in result

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
        patch.object(provider.marketplace, "rent_instance", side_effect=Exception("API Error")),
    ):
        result = provider.rent_compute(
            {"cluster_name": "us-east-1", "node_name": "node-789", "gpu_count": "2"}
        )
        assert "Error renting compute: API Error" in result


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
