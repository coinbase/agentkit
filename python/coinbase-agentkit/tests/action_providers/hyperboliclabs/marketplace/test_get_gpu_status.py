"""Tests for get_gpu_status action in HyperbolicMarketplaceActionProvider."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    MarketplaceActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.models import (
    GpuHardware,
    HardwareInfo,
    NodeInstance,
    NodeRental,
    RentedInstancesResponse,
)


@pytest.fixture
def mock_api_response():
    """Mock API response for GPU status."""
    gpu = GpuHardware(
        hardware_type="gpu",
        model="NVIDIA A100",
        ram=40000,
    )

    hardware = HardwareInfo(
        gpus=[gpu],
    )

    instance1 = NodeInstance(
        id="instance-1",
        status="running",
        hardware=hardware,
        gpu_count=2,
    )

    instance2 = NodeInstance(
        id="instance-2",
        status="starting",
        hardware=hardware,
        gpu_count=1,
    )

    rental1 = NodeRental(
        id="i-123456",
        instance=instance1,
        ssh_command="ssh user@host -i key.pem",
    )

    rental2 = NodeRental(
        id="i-789012",
        instance=instance2,
    )

    return RentedInstancesResponse(instances=[rental1, rental2])


@pytest.fixture
def provider(mock_api_key):
    """Create HyperbolicMarketplaceActionProvider instance with test API key."""
    return MarketplaceActionProvider(api_key=mock_api_key)


def test_get_gpu_status_success(provider, mock_api_response):
    """Test successful get_gpu_status action."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_rented_instances", return_value=mock_api_response),
    ):
        result = provider.get_gpu_status({})

        # Check first instance (running)
        assert "Your Rented GPU Instances:" in result
        assert "Instance ID: i-123456" in result
        assert "Status: running (Ready to use)" in result
        assert "GPU Model: NVIDIA A100" in result
        assert "GPU Count: 2" in result
        assert "GPU Memory: 40000.0 GB" in result
        assert "ssh user@host -i key.pem" in result

        # Check second instance (starting)
        assert "Instance ID: i-789012" in result
        assert "Status: starting (Still initializing)" in result
        assert "GPU Model: NVIDIA A100" in result
        assert "GPU Count: 1" in result
        assert "GPU Memory: 40000.0 GB" in result
        assert "The instance is starting up. Please check again in a few seconds." in result

        # Check SSH instructions
        assert "SSH Connection Instructions:" in result
        assert "1. Wait until instance status is 'running'" in result
        assert "2. Use the ssh_connect action" in result


def test_get_gpu_status_no_instances(provider):
    """Test get_gpu_status action with no instances."""
    empty_response = RentedInstancesResponse(instances=[])

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_rented_instances", return_value=empty_response),
    ):
        result = provider.get_gpu_status({})
        assert "No rented GPU instances found." in result


def test_get_gpu_status_api_error(provider):
    """Test get_gpu_status action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace, "get_rented_instances", side_effect=Exception("API Error")
        ),
    ):
        result = provider.get_gpu_status({})
        assert "Error retrieving GPU status: API Error" in result


def test_get_gpu_status_malformed_instance(provider):
    """Test get_gpu_status action with malformed instance data."""
    hardware = HardwareInfo(gpus=[])
    instance = NodeInstance(
        id="instance-3",
        status="Unknown",
        hardware=hardware,
    )
    rental = NodeRental(id="i-123456", instance=instance)
    response = RentedInstancesResponse(instances=[rental])

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_rented_instances", return_value=response),
    ):
        result = provider.get_gpu_status({})

        # Check that defaults are used
        assert "Instance ID: i-123456" in result
        assert "Status: Unknown (Instance is still being provisioned)" in result
        assert "GPU Model: Unknown Model" in result
        assert "GPU Count: 1" in result  # Default GPU count
        assert "Instance is still being provisioned" in result
        assert "Please check again in 30-60 seconds" in result
