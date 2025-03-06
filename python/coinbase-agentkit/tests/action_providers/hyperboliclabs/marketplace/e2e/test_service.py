"""End-to-end tests for Hyperbolic Marketplace service.

These tests make real API calls to the Hyperbolic platform.
They require a valid API key in the HYPERBOLIC_API_KEY environment variable.
"""

import json
import time

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    AvailableInstance,
    AvailableInstancesResponse,
    InstanceHistoryEntry,
    InstanceHistoryResponse,
    RentedInstancesResponse,
    RentInstanceResponse,
    TerminateInstanceRequest,
    TerminateInstanceResponse,
)


@pytest.mark.e2e
def test_marketplace_available_instances(marketplace):
    """Test getting available GPU instances."""
    response = marketplace.get_available_instances()
    print("\nAvailable instances response:", json.dumps(response.model_dump(), indent=2))

    assert isinstance(response, AvailableInstancesResponse)
    assert isinstance(response.instances, list)

    if response.instances:
        instance = response.instances[0]
        assert isinstance(instance, AvailableInstance)
        assert instance.id is not None
        assert instance.status is not None
        assert instance.hardware is not None
        assert instance.hardware.gpus is not None
        assert len(instance.hardware.gpus) > 0

        gpu = instance.hardware.gpus[0]
        assert gpu.model is not None
        assert gpu.ram is not None
        assert gpu.hardware_type == "gpu"

        assert instance.gpus_total > 0
        assert instance.gpus_reserved >= 0
        assert instance.gpus_reserved <= instance.gpus_total

        assert instance.pricing is not None
        assert instance.pricing.price is not None
        assert instance.pricing.price.amount > 0
        assert instance.pricing.price.period == "hourly"
        assert instance.pricing.price.agent == "platform"


@pytest.mark.e2e
def test_marketplace_instance_history(marketplace):
    """Test getting GPU instance rental history."""
    response = marketplace.get_instance_history()
    print("\nInstance history response:", json.dumps(response.model_dump(), indent=2))

    assert isinstance(response, InstanceHistoryResponse)
    assert isinstance(response.instance_history, list)

    if response.instance_history:
        entry = response.instance_history[0]
        assert isinstance(entry, InstanceHistoryEntry)
        assert entry.instance_name is not None
        assert entry.price is not None
        assert entry.hardware is not None
        assert entry.gpu_count > 0


@pytest.mark.e2e
def test_marketplace_rented_instances(marketplace):
    """Test getting rented GPU instances."""
    response = marketplace.get_rented_instances()
    print("\nRented nodes response:", json.dumps(response.model_dump(), indent=2))

    assert isinstance(response, RentedInstancesResponse)
    assert isinstance(response.instances, list)

    if response.instances:
        node = response.instances[0]
        assert node.id is not None
        assert node.status is not None
        assert node.instance is not None

        node_details = node.instance
        assert node_details.hardware is not None
        assert node_details.hardware.cpus is not None
        assert node_details.hardware.gpus is not None
        assert node_details.hardware.storage is not None
        assert node_details.hardware.ram is not None

        assert node.ssh_command is not None or node.ssh_access is not None


@pytest.mark.e2e
@pytest.mark.skip(
    reason="This test rents actual GPU instances and incurs costs. Only run manually."
)
def test_marketplace_rent(marketplace, rented_instance):
    """Test renting a GPU instance.

    WARNING: This test will rent actual GPU instances and incurs costs.
    It should only be run manually and with full awareness of the costs involved.
    """
    instance_id, rent_response = rented_instance

    assert isinstance(rent_response, RentInstanceResponse)
    assert rent_response.status == "success"
    assert rent_response.instance_name is not None
    assert rent_response.instance_name == instance_id

    print("\nWaiting for instance to initialize...")
    time.sleep(3)

    rented = marketplace.get_rented_instances()
    assert any(i.id == instance_id for i in rented.instances), "Rented instance not found"

    instance = next(i for i in rented.instances if i.id == instance_id)

    assert instance.status is not None
    assert instance.instance is not None
    assert instance.instance.hardware is not None
    assert instance.instance.hardware.gpus is not None

    if instance.status.lower() in ["running", "online"]:
        assert instance.ssh_command is not None or instance.ssh_access is not None


@pytest.mark.e2e
@pytest.mark.skip(
    reason="This test terminates actual GPU instances and incurs costs. Only run manually."
)
@pytest.mark.disable_auto_terminate
def test_marketplace_terminate(marketplace, rented_instance, request):
    """Test terminating a GPU instance.

    This test can run in two modes:
    1. Normal mode: Rents an instance and terminates it explicitly (default)
    2. Manual mode: With @pytest.mark.disable_auto_terminate marker, rents an instance but doesn't
       terminate it, allowing manual termination via the action provider

    WARNING: This test rents actual GPU instances.
    It should only be run manually and with full awareness of the implications.
    When using the disable_auto_terminate marker, remember to manually terminate
    the instance to avoid unnecessary costs.
    """
    instance_id, _ = rented_instance

    print("\nWaiting for instance to be ready for termination...")
    time.sleep(3)

    terminate_request = TerminateInstanceRequest(id=instance_id)
    terminate_response = marketplace.terminate_instance(terminate_request)

    assert isinstance(terminate_response, TerminateInstanceResponse)
    assert terminate_response.status == "success"

    time.sleep(3)

    rented = marketplace.get_rented_instances()
    instance_status = next(
        (i.status.lower() for i in rented.instances if i.id == instance_id), None
    )
    assert instance_status in [
        None,
        "terminated",
        "terminating",
    ], f"Instance should be terminated but is {instance_status}"
