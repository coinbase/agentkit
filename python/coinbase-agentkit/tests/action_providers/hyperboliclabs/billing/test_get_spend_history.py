"""Tests for get_spend_history action in HyperbolicBillingActionProvider."""

from unittest.mock import Mock

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    GpuHardware,
    HardwareInfo,
    InstanceHistoryEntry,
    InstanceHistoryResponse,
    Price,
)


def test_get_spend_history_success(provider):
    """Test successful get_spend_history action."""
    instance_entries = [
        InstanceHistoryEntry(
            instance_name="instance-123",
            started_at="2024-01-15T12:00:00Z",
            terminated_at="2024-01-15T13:00:00Z",
            gpu_count=2,
            hardware=HardwareInfo(
                gpus=[
                    GpuHardware(
                        hardware_type="gpu",
                        model="NVIDIA A100",
                        ram=80.0,
                    )
                ]
            ),
            price=Price(
                amount=2500.0,
                period="hourly",
            ),
        ),
        InstanceHistoryEntry(
            instance_name="instance-456",
            started_at="2024-01-14T10:00:00Z",
            terminated_at="2024-01-14T12:00:00Z",
            gpu_count=1,
            hardware=HardwareInfo(
                gpus=[
                    GpuHardware(
                        hardware_type="gpu",
                        model="NVIDIA A100",
                        ram=80.0,
                    )
                ]
            ),
            price=Price(
                amount=1250.0,
                period="hourly",
            ),
        ),
    ]

    provider.marketplace.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=instance_entries)
    )

    result = provider.get_spend_history({})

    assert "=== GPU Rental Spending Analysis ===" in result
    assert "Instance Rentals (showing 2 most recent):" in result
    assert "- instance-123:" in result
    assert "GPU: NVIDIA A100 (Count: 2)" in result
    assert "Duration: 3600 seconds" in result
    assert "Cost: $25.00" in result
    assert "- instance-456:" in result
    assert "GPU: NVIDIA A100 (Count: 1)" in result
    assert "Duration: 7200 seconds" in result
    assert "Cost: $25.00" in result
    assert "GPU Type Statistics (showing 1 most recent):" in result
    assert "NVIDIA A100:" in result
    assert "Total Rentals: 3" in result
    assert "Total Time: 10800 seconds" in result
    assert "Total Cost: $50.00" in result
    assert "Total Spending: $50.00" in result


def test_get_spend_history_empty(provider):
    """Test get_spend_history action with empty history."""
    provider.marketplace.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=[])
    )

    result = provider.get_spend_history({})
    assert "No rental history found." in result


def test_get_spend_history_api_error(provider):
    """Test get_spend_history action with API error."""
    provider.marketplace.get_instance_history = Mock(side_effect=Exception("API Error"))

    result = provider.get_spend_history({})
    assert "Error: Spend history retrieval: API Error" in result


def test_get_spend_history_invalid_response(provider):
    """Test get_spend_history action with invalid response format."""
    provider.marketplace.get_instance_history = Mock(side_effect=Exception("Invalid response"))

    result = provider.get_spend_history({})
    assert "Error: Spend history retrieval: Invalid response" in result


def test_get_spend_history_malformed_instance(provider):
    """Test get_spend_history action with malformed instance data."""
    instance_entry = InstanceHistoryEntry(
        instance_name="instance-123",
        started_at="2024-01-15T12:00:00Z",
        terminated_at="2024-01-15T13:00:00Z",
        gpu_count=0,
        hardware=HardwareInfo(
            gpus=[
                GpuHardware(
                    hardware_type="gpu",
                    model="Unknown GPU",
                )
            ]
        ),
        price=Price(
            amount=0.0,
            period="hourly",
        ),
    )

    provider.marketplace.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=[instance_entry])
    )

    result = provider.get_spend_history({})

    assert "- instance-123:" in result
    assert "GPU: Unknown GPU (Count: 0)" in result
    assert "Duration: 3600 seconds" in result
    assert "Cost: $0.00" in result


def test_get_spend_history_missing_timestamps(provider):
    """Test get_spend_history action with missing timestamp data."""
    instance_entries = [
        InstanceHistoryEntry(
            instance_name="instance-123",
            started_at="2024-01-15T12:00:00Z",
            terminated_at="2024-01-15T13:00:00Z",
            gpu_count=1,
            hardware=HardwareInfo(
                gpus=[
                    GpuHardware(
                        hardware_type="gpu",
                        model="NVIDIA A100",
                        ram=80.0,
                    )
                ]
            ),
            price=Price(
                amount=2500.0,
                period="hourly",
            ),
        ),
        InstanceHistoryEntry(
            instance_name="instance-456",
            started_at=None,
            terminated_at=None,
            gpu_count=2,
            hardware=HardwareInfo(
                gpus=[
                    GpuHardware(
                        hardware_type="gpu",
                        model="NVIDIA A100",
                        ram=80.0,
                    )
                ]
            ),
            price=Price(
                amount=1250.0,
                period="hourly",
            ),
        ),
        InstanceHistoryEntry(
            instance_name="instance-789",
            started_at="2024-01-14T10:00:00Z",
            terminated_at=None,
            gpu_count=1,
            hardware=HardwareInfo(
                gpus=[
                    GpuHardware(
                        hardware_type="gpu",
                        model="NVIDIA A100",
                        ram=80.0,
                    )
                ]
            ),
            price=Price(
                amount=1250.0,
                period="hourly",
            ),
        ),
    ]

    provider.marketplace.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=instance_entries)
    )

    result = provider.get_spend_history({})

    assert "- instance-123:" in result
    assert "GPU: NVIDIA A100 (Count: 1)" in result
    assert "Duration: 3600 seconds" in result
    assert "Cost: $25.00" in result

    assert "- instance-456:" in result
    assert "GPU: NVIDIA A100 (Count: 2)" in result
    assert "Duration: Unavailable (missing timestamp data)" in result
    assert "Cost: Unavailable" in result

    assert "- instance-789:" in result
    assert "GPU: NVIDIA A100 (Count: 1)" in result
    assert "Duration: Unavailable (missing timestamp data)" in result
    assert "Cost: Unavailable" in result

    assert "Total Rentals: 1" in result
    assert "Total Spending: $25.00" in result


def test_get_spend_history_missing_hardware(provider):
    """Test get_spend_history action with edge cases: multiple GPUs, unknown models, empty instance name."""
    instance_entries = [
        InstanceHistoryEntry(
            instance_name="instance-123",
            started_at="2024-01-15T12:00:00Z",
            terminated_at="2024-01-15T13:00:00Z",
            gpu_count=2,
            hardware=HardwareInfo(
                gpus=[
                    GpuHardware(hardware_type="gpu", model="NVIDIA A100"),
                    GpuHardware(hardware_type="gpu", model="NVIDIA V100"),
                ]
            ),
            price=Price(amount=2500.0, period="hourly"),
        ),
        InstanceHistoryEntry(
            instance_name="",
            started_at="2024-01-15T12:00:00Z",
            terminated_at="2024-01-15T13:00:00Z",
            gpu_count=1,
            hardware=HardwareInfo(gpus=[GpuHardware(hardware_type="gpu", model="NVIDIA A100")]),
            price=Price(amount=2500.0, period="hourly"),
        ),
    ]

    provider.marketplace.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=instance_entries)
    )

    result = provider.get_spend_history({})

    assert "GPU: NVIDIA A100, NVIDIA V100 (Count: 2)" in result
    assert "unnamed-instance" in result
    assert "None" not in result
