"""Tests for get_available_gpus action in HyperbolicMarketplaceActionProvider."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    MarketplaceActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    AvailableInstance,
    AvailableInstancesResponse,
    CpuHardware,
    GpuHardware,
    HardwareInfo,
    Location,
    Price,
    PricingInfo,
    RamHardware,
    StorageHardware,
)


@pytest.fixture
def mock_api_response():
    """Mock API response for available GPUs."""
    gpu = GpuHardware(
        hardware_type="gpu",
        model="NVIDIA-GeForce-RTX-3070",
        clock_speed=1000,
        compute_power=1000,
        ram=8192,
        interface="PCIeX16",
    )

    cpu = CpuHardware(hardware_type="cpu", model="AMD-23-49", virtual_cores=32)

    storage = StorageHardware(hardware_type="storage", capacity=80)

    ram = RamHardware(hardware_type="ram", capacity=1070)

    hardware = HardwareInfo(cpus=[cpu], gpus=[gpu], storage=[storage], ram=[ram])

    price1 = Price(amount=2000, period="hourly", agent="platform")
    price2 = Price(amount=1600, period="hourly", agent="platform")

    instance1 = AvailableInstance(
        id="korea-amd14-78",
        status="node_ready",
        hardware=hardware,
        location=Location(region="region-1"),
        gpus_total=1,
        gpus_reserved=0,
        has_persistent_storage=True,
        pricing=PricingInfo(price=price1),
        reserved=False,
        cluster_name="angelic-mushroom-dolphin",
    )

    instance2 = AvailableInstance(
        id="korea-amd11-181",
        status="node_ready",
        hardware=hardware,
        location=Location(region="region-1"),
        gpus_total=1,
        gpus_reserved=0,
        has_persistent_storage=True,
        pricing=PricingInfo(price=price2),
        reserved=False,
        cluster_name="beneficial-palm-boar",
    )

    return AvailableInstancesResponse(instances=[instance1, instance2])


@pytest.fixture
def provider(mock_api_key):
    """Create HyperbolicMarketplaceActionProvider instance with test API key."""
    return MarketplaceActionProvider(api_key=mock_api_key)


def test_get_available_gpus_success(provider, mock_api_response):
    """Test successful get_available_gpus action."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace, "get_available_instances", return_value=mock_api_response
        ),
    ):
        result = provider.get_available_gpus({})

        assert "Available GPU Options:" in result

        assert "Cluster: angelic-mushroom-dolphin" in result
        assert "Node ID: korea-amd14-78" in result
        assert "GPU Model: NVIDIA-GeForce-RTX-3070" in result
        assert "Available GPUs: 1/1" in result
        assert "Price: $20.00/hour per GPU" in result

        assert "Cluster: beneficial-palm-boar" in result
        assert "Node ID: korea-amd11-181" in result
        assert "GPU Model: NVIDIA-GeForce-RTX-3070" in result
        assert "Available GPUs: 1/1" in result
        assert "Price: $16.00/hour per GPU" in result

        first_idx = result.find("angelic-mushroom-dolphin")
        second_idx = result.find("beneficial-palm-boar")
        assert first_idx < second_idx, "GPU instances should be listed in order"


def test_get_available_gpus_empty_response(provider):
    """Test get_available_gpus action with empty response."""
    empty_response = AvailableInstancesResponse(instances=[])

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_available_instances", return_value=empty_response),
    ):
        result = provider.get_available_gpus({})
        assert "No available GPU instances found." in result


def test_get_available_gpus_api_error(provider):
    """Test get_available_gpus action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace, "get_available_instances", side_effect=Exception("API Error")
        ),
    ):
        result = provider.get_available_gpus({})
        assert "Error: GPU retrieval: API Error" in result
