"""Tests for get_available_gpus_types and get_available_gpus_by_type actions in HyperbolicMarketplaceActionProvider."""

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
def mock_response():
    """Mock API response for available GPUs with different models."""
    gpu1 = GpuHardware(
        hardware_type="gpu",
        model="NVIDIA-GeForce-RTX-3070",
        clock_speed=1000,
        compute_power=1000,
        ram=8192,
        interface="PCIeX16",
    )

    gpu2 = GpuHardware(
        hardware_type="gpu",
        model="NVIDIA-A100",
        clock_speed=1200,
        compute_power=1500,
        ram=40960,
        interface="PCIeX16",
    )

    cpu = CpuHardware(hardware_type="cpu", model="AMD-23-49", virtual_cores=32)
    storage = StorageHardware(hardware_type="storage", capacity=80)
    ram = RamHardware(hardware_type="ram", capacity=1070)

    hardware1 = HardwareInfo(cpus=[cpu], gpus=[gpu1], storage=[storage], ram=[ram])
    hardware2 = HardwareInfo(cpus=[cpu], gpus=[gpu2], storage=[storage], ram=[ram])

    price1 = Price(amount=2000, period="hourly", agent="platform")
    price2 = Price(amount=1600, period="hourly", agent="platform")
    price3 = Price(amount=3000, period="hourly", agent="platform")

    instance1 = AvailableInstance(
        id="korea-amd14-78",
        status="node_ready",
        hardware=hardware1,
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
        hardware=hardware1,
        location=Location(region="region-1"),
        gpus_total=1,
        gpus_reserved=0,
        has_persistent_storage=True,
        pricing=PricingInfo(price=price2),
        reserved=False,
        cluster_name="beneficial-palm-boar",
    )

    instance3 = AvailableInstance(
        id="us-east-a100-01",
        status="node_ready",
        hardware=hardware2,
        location=Location(region="region-2"),
        gpus_total=4,
        gpus_reserved=1,
        has_persistent_storage=True,
        pricing=PricingInfo(price=price3),
        reserved=False,
        cluster_name="quantum-crystal-hawk",
    )

    instance4 = AvailableInstance(
        id="korea-amd11-999",
        status="node_ready",
        hardware=hardware1,
        location=Location(region="region-1"),
        gpus_total=1,
        gpus_reserved=1,
        has_persistent_storage=True,
        pricing=PricingInfo(price=price2),
        reserved=False,
        cluster_name="peaceful-ocean-bear",
    )

    return AvailableInstancesResponse(instances=[instance1, instance2, instance3, instance4])


@pytest.fixture
def provider(mock_api_key):
    """Create HyperbolicMarketplaceActionProvider instance with test API key."""
    return MarketplaceActionProvider(api_key=mock_api_key)


def test_get_available_gpus_types_success(provider, mock_response):
    """Test successful get_available_gpus_types action."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_available_instances", return_value=mock_response),
    ):
        result = provider.get_available_gpus_types({})

        assert "Available GPU Types:" in result

        assert "NVIDIA-GeForce-RTX-3070" in result
        assert "NVIDIA-A100" in result


def test_get_available_gpus_types_empty_response(provider):
    """Test get_available_gpus_types action with empty response."""
    empty_response = AvailableInstancesResponse(instances=[])

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_available_instances", return_value=empty_response),
    ):
        result = provider.get_available_gpus_types({})
        assert "No available GPU instances found." in result


def test_get_available_gpus_types_api_error(provider):
    """Test get_available_gpus_types action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace, "get_available_instances", side_effect=Exception("API Error")
        ),
    ):
        result = provider.get_available_gpus_types({})
        assert "Error: GPU types retrieval: API Error" in result


def test_get_available_gpus_by_type_success(provider, mock_response):
    """Test successful get_available_gpus_by_type action."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_available_instances", return_value=mock_response),
    ):
        result = provider.get_available_gpus_by_type({"gpu_model": "NVIDIA-GeForce-RTX-3070"})

        assert "Available NVIDIA-GeForce-RTX-3070 GPU Options:" in result

        assert "Cluster: angelic-mushroom-dolphin" in result
        assert "Node ID: korea-amd14-78" in result
        assert "GPU Model: NVIDIA-GeForce-RTX-3070" in result
        assert "Price: $20.00/hour per GPU" in result

        assert "Cluster: beneficial-palm-boar" in result
        assert "Node ID: korea-amd11-181" in result
        assert "GPU Model: NVIDIA-GeForce-RTX-3070" in result
        assert "Price: $16.00/hour per GPU" in result

        assert "Cluster: quantum-crystal-hawk" not in result
        assert "Node ID: us-east-a100-01" not in result

        result = provider.get_available_gpus_by_type({"gpu_model": "NVIDIA-A100"})

        assert "Available NVIDIA-A100 GPU Options:" in result

        assert "Cluster: quantum-crystal-hawk" in result
        assert "Node ID: us-east-a100-01" in result
        assert "GPU Model: NVIDIA-A100" in result
        assert "Available GPUs: 3/4" in result
        assert "Price: $30.00/hour per GPU" in result

        assert "Cluster: angelic-mushroom-dolphin" not in result
        assert "Cluster: beneficial-palm-boar" not in result


def test_get_available_gpus_by_type_not_found(provider, mock_response):
    """Test get_available_gpus_by_type action with GPU model not found."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_available_instances", return_value=mock_response),
    ):
        result = provider.get_available_gpus_by_type({"gpu_model": "NVIDIA-H100"})
        assert "No available GPU instances with the model 'NVIDIA-H100' found." in result


def test_get_available_gpus_by_type_empty_response(provider):
    """Test get_available_gpus_by_type action with empty response."""
    empty_response = AvailableInstancesResponse(instances=[])

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_available_instances", return_value=empty_response),
    ):
        result = provider.get_available_gpus_by_type({"gpu_model": "NVIDIA-A100"})
        assert "No available GPU instances found." in result


def test_get_available_gpus_by_type_api_error(provider):
    """Test get_available_gpus_by_type action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace, "get_available_instances", side_effect=Exception("API Error")
        ),
    ):
        result = provider.get_available_gpus_by_type({"gpu_model": "NVIDIA-A100"})
        assert "Error: GPU retrieval: API Error" in result
