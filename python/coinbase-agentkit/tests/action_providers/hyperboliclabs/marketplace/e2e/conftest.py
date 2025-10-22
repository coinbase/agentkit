"""Fixtures for marketplace service end-to-end tests."""

import json
import time

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    RentInstanceRequest,
    TerminateInstanceRequest,
)


@pytest.fixture
def rented_instance(marketplace, request):
    """Fixture to rent the cheapest available instance.

    This fixture will:
    1. Find the cheapest available instance in North America
    2. Rent it
    3. Ensure it's terminated after the test (unless disable_auto_terminate is True)

    WARNING: This fixture rents actual GPU instances and incurs costs.
    It should only be used in tests that are explicitly marked to run manually.

    The fixture will fail if:
    - No instances are available
    - Instance rental fails
    - Instance termination fails or instance remains running

    Args:
        marketplace: The marketplace service fixture
        request: The pytest request object to get marker information

    Yields:
        tuple: (instance_id, original_response) of the rented instance

    Raises:
        AssertionError: If instance cannot be terminated properly
        Exception: For other failures during rental or cleanup

    """
    disable_auto_terminate = False
    marker = request.node.get_closest_marker("disable_auto_terminate")
    if marker:
        disable_auto_terminate = True
        print(
            "\nWARNING: Auto-termination is disabled. Remember to manually terminate the instance!"
        )

    available = marketplace.get_available_instances()
    assert len(available.instances) > 0, "No instances available to rent"

    print("\nAll available instances:")
    for instance in available.instances:
        print(f"\nCluster: {instance.cluster_name}")
        print(f"Node: {instance.id}")
        print(f"Price: ${instance.pricing.price.amount/100:.2f}/hour")
        print(f"Reserved: {instance.reserved}")
        print(f"Status: {instance.status}")
        if instance.location and instance.location.region:
            print(f"Region: {instance.location.region}")
        print(f"GPUs: {instance.gpus_total} total, {instance.gpus_reserved} reserved")
        if instance.hardware and instance.hardware.gpus:
            for gpu in instance.hardware.gpus:
                print(f"GPU Model: {gpu.model}")

    def is_na_instance(instance):
        """Check if instance is in North America based on node name patterns."""
        node_id = instance.id.lower()
        na_patterns = ["las1", "ceti", "ses", "gpu-compute"]
        return any(pattern in node_id for pattern in na_patterns)

    available_instances = [
        i
        for i in available.instances
        if not i.reserved and is_na_instance(i) and (i.gpus_total - i.gpus_reserved) > 0
    ]
    assert (
        len(available_instances) > 0
    ), "No unreserved North American instances with available GPUs found"

    selected_instance = min(available_instances, key=lambda i: i.pricing.price.amount)

    print("\nSelected North American instance:")
    print(f"Cluster: {selected_instance.cluster_name}")
    print(f"Node: {selected_instance.id}")
    print(f"Price: ${selected_instance.pricing.price.amount/100:.2f}/hour")
    print(f"Available GPUs: {selected_instance.gpus_total - selected_instance.gpus_reserved}")

    instance_id = None
    try:
        request = RentInstanceRequest(
            cluster_name=selected_instance.cluster_name, node_name=selected_instance.id, gpu_count=1
        )

        response = marketplace.rent_instance(request)
        print("\nFull API response:", json.dumps(response.model_dump(), indent=2))

        assert response.status == "success"
        assert response.instance_name is not None, "API returned success but no instance name"

        instance_id = response.instance_name

        yield instance_id, response

    finally:
        if instance_id and not disable_auto_terminate:
            print(f"\nCleaning up instance {instance_id}")
            try:
                wait_for_termination(marketplace, instance_id)
            except Exception as e:
                error_msg = (
                    f"Error during cleanup of instance {instance_id}: {e}\n"
                    "IMPORTANT: You may have a running instance still incurring costs!"
                )
                raise Exception(error_msg) from e
        elif instance_id and disable_auto_terminate:
            print(f"\nSkipping auto-termination for instance {instance_id} as requested.")
            print(
                "IMPORTANT: Remember to manually terminate this instance to avoid unnecessary costs!"
            )


def wait_for_termination(
    marketplace, instance_id: str, max_retries: int = 3, wait_seconds: int = 5
) -> None:
    """Wait for an instance to be fully terminated.

    Args:
        marketplace: The marketplace service instance
        instance_id: ID of the instance to check
        max_retries: Maximum number of termination attempts
        wait_seconds: Seconds to wait between checks

    Raises:
        AssertionError: If instance doesn't terminate after max retries

    """
    for attempt in range(max_retries):
        terminate_request = TerminateInstanceRequest(id=instance_id)
        terminate_response = marketplace.terminate_instance(terminate_request)
        assert (
            terminate_response.status == "success"
        ), f"Termination failed: {terminate_response.message}"

        time.sleep(wait_seconds)
        rented = marketplace.get_rented_instances()
        still_running = [
            i.id for i in rented.instances if i.status.lower() not in ["terminated", "terminating"]
        ]

        if instance_id not in still_running:
            print(f"Instance {instance_id} successfully terminated")
            return

        if attempt < max_retries - 1:
            print(f"Instance still running, retrying... (attempt {attempt + 1}/{max_retries})")

    raise AssertionError(
        f"Failed to terminate instance {instance_id} after {max_retries} attempts. "
        "IMPORTANT: You may have a running instance still incurring costs!"
    )


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "e2e: mark tests as end-to-end tests (may incur costs)")
    config.addinivalue_line(
        "markers",
        "disable_auto_terminate: mark tests to disable automatic termination of GPU instances (DANGER: instances must be manually terminated!)",
    )
