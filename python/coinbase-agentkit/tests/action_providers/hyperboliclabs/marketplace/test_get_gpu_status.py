"""Tests for the get_gpu_status action in HyperbolicMarketplaceActionProvider."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    MarketplaceActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    CpuHardware,
    GpuHardware,
    HardwareInfo,
    NodeInstance,
    NodeRental,
    RamHardware,
    RentedInstancesResponse,
    SSHAccess,
    StorageHardware,
)


@pytest.fixture
def mock_rented_instances_with_ssh_command():
    """Mock response for rented instances with ssh_command."""
    gpu = GpuHardware(
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
    hardware = HardwareInfo(cpus=[cpu], gpus=[gpu], storage=[storage], ram=[ram])

    node_instance = NodeInstance(
        id="node-123",
        status="running",
        hardware=hardware,
        gpu_count=1,
    )

    rental_with_ssh_command = NodeRental(
        id="running-instance-1",
        start="2023-01-01T00:00:00Z",
        end=None,
        instance=node_instance,
        ssh_command="ssh user@hostname.example.com -i ~/.ssh/id_rsa",
        ssh_access=None,
    )

    return RentedInstancesResponse(instances=[rental_with_ssh_command])


@pytest.fixture
def mock_rented_instances_with_ssh_access():
    """Mock response for rented instances with ssh_access."""
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

    node_instance = NodeInstance(
        id="node-456",
        status="running",
        hardware=hardware,
        gpu_count=1,
    )

    ssh_access = SSHAccess(
        host="hostname2.example.com",
        username="ubuntu",
        key_path="~/.ssh/id_rsa",
        ssh_command=None,
    )

    rental_with_ssh_access = NodeRental(
        id="running-instance-2",
        start="2023-01-01T00:00:00Z",
        end=None,
        instance=node_instance,
        ssh_command=None,
        ssh_access=ssh_access,
    )

    return RentedInstancesResponse(instances=[rental_with_ssh_access])


@pytest.fixture
def mock_rented_instances_without_ssh():
    """Mock response for rented instances without SSH command or access."""
    gpu = GpuHardware(
        hardware_type="gpu",
        model="NVIDIA-H100",
        clock_speed=1500,
        compute_power=2000,
        ram=81920,
        interface="PCIeX16",
    )

    cpu = CpuHardware(hardware_type="cpu", model="AMD-23-49", virtual_cores=32)
    storage = StorageHardware(hardware_type="storage", capacity=80)
    ram = RamHardware(hardware_type="ram", capacity=1070)
    hardware = HardwareInfo(cpus=[cpu], gpus=[gpu], storage=[storage], ram=[ram])

    node_instance = NodeInstance(
        id="node-789",
        status="starting",
        hardware=hardware,
        gpu_count=1,
    )

    rental_without_ssh = NodeRental(
        id="starting-instance-1",
        start="2023-01-01T00:00:00Z",
        end=None,
        instance=node_instance,
        ssh_command=None,
        ssh_access=None,
    )

    return RentedInstancesResponse(instances=[rental_without_ssh])


@pytest.fixture
def provider(mock_api_key):
    """Create HyperbolicMarketplaceActionProvider instance with test API key."""
    return MarketplaceActionProvider(api_key=mock_api_key)


def test_get_gpu_status_with_ssh_command(provider, mock_rented_instances_with_ssh_command):
    """Test get_gpu_status when instances have ssh_command."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace,
            "get_rented_instances",
            return_value=mock_rented_instances_with_ssh_command,
        ),
    ):
        result = provider.get_gpu_status({})

        assert "Your Rented GPU Instances:" in result

        assert "Instance ID: running-instance-1" in result
        assert "Status: running (Ready to use)" in result
        assert "GPU Model: NVIDIA-A100" in result
        assert "GPU Count: 1" in result
        assert "GPU Memory: 40.0 GB" in result

        assert "SSH Command: ssh user@hostname.example.com -i ~/.ssh/id_rsa" in result

        assert "SSH Connection Instructions:" in result
        assert "1. Wait until instance status is 'running'" in result
        assert "2. Use the ssh_connect action with the provided host and username" in result
        assert "3. Once connected, use remote_shell to execute commands" in result


def test_get_gpu_status_with_ssh_access(provider, mock_rented_instances_with_ssh_access):
    """Test get_gpu_status when instances have ssh_access but no ssh_command."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace,
            "get_rented_instances",
            return_value=mock_rented_instances_with_ssh_access,
        ),
    ):
        result = provider.get_gpu_status({})

        assert "Your Rented GPU Instances:" in result

        assert "Instance ID: running-instance-2" in result
        assert "Status: running (Ready to use)" in result
        assert "GPU Model: NVIDIA-GeForce-RTX-3070" in result
        assert "GPU Count: 1" in result
        assert "GPU Memory: 8.0 GB" in result

        assert "SSH Command: ssh ubuntu@hostname2.example.com -i ~/.ssh/id_rsa" in result

        assert "SSH Connection Instructions:" in result
        assert "1. Wait until instance status is 'running'" in result
        assert "2. Use the ssh_connect action with the provided host and username" in result
        assert "3. Once connected, use remote_shell to execute commands" in result


def test_get_gpu_status_without_ssh(provider, mock_rented_instances_without_ssh):
    """Test get_gpu_status when instances have no SSH information."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace,
            "get_rented_instances",
            return_value=mock_rented_instances_without_ssh,
        ),
    ):
        result = provider.get_gpu_status({})

        assert "Your Rented GPU Instances:" in result

        assert "Instance ID: starting-instance-1" in result
        assert "Status: starting (Still initializing)" in result
        assert "GPU Model: NVIDIA-H100" in result
        assert "GPU Count: 1" in result
        assert "GPU Memory: 80.0 GB" in result

        assert "SSH Command: Not available yet. Instance is still being provisioned." in result
        assert "The instance is starting up. Please check again in a few seconds." in result

        assert "SSH Connection Instructions:" in result
        assert "1. Wait until instance status is 'running'" in result
        assert "2. Use the ssh_connect action with the provided host and username" in result
        assert "3. Once connected, use remote_shell to execute commands" in result


def test_get_gpu_status_empty_response(provider):
    """Test get_gpu_status with no rented instances."""
    empty_response = RentedInstancesResponse(instances=[])

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(provider.marketplace, "get_rented_instances", return_value=empty_response),
    ):
        result = provider.get_gpu_status({})
        assert "No rented GPU instances found." in result


def test_get_gpu_status_api_error(provider):
    """Test get_gpu_status with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch.object(
            provider.marketplace, "get_rented_instances", side_effect=Exception("API Error")
        ),
    ):
        result = provider.get_gpu_status({})
        assert "Error: GPU status retrieval: API Error" in result
