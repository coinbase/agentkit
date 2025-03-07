"""Tests for get_spend_history action in HyperbolicBillingActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.billing import (
    HyperbolicBillingActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.billing.models import (
    InstanceHistoryResponse,
    InstanceHistoryEntry,
    HardwareInfo,
    GpuHardware,
    Price,
)


@pytest.fixture
def provider():
    """Create HyperbolicBillingActionProvider instance with test API key."""
    return HyperbolicBillingActionProvider(api_key="test-api-key")


def test_get_spend_history_success(provider):
    """Test successful get_spend_history action."""
    # Create instance history entries
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
    
    # Mock the service method
    provider.billing.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=instance_entries)
    )

    # Call the method
    result = provider.get_spend_history({})

    # Check the response formatting
    assert "=== GPU Rental Spending Analysis ===" in result
    assert "Instance Rentals:" in result
    assert "- instance-123:" in result
    assert "GPU: NVIDIA A100 (Count: 2)" in result
    assert "Duration: 3600 seconds" in result
    assert "Cost: $25.00" in result
    assert "- instance-456:" in result
    assert "GPU: NVIDIA A100 (Count: 1)" in result
    assert "Duration: 7200 seconds" in result
    assert "Cost: $25.00" in result
    assert "GPU Type Statistics:" in result
    assert "NVIDIA A100:" in result
    assert "Total Rentals: 3" in result
    assert "Total Time: 10800 seconds" in result
    assert "Total Cost: $50.00" in result
    assert "Total Spending: $50.00" in result


def test_get_spend_history_empty(provider):
    """Test get_spend_history action with empty history."""
    # Mock the service method
    provider.billing.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=[])
    )

    # Call the method
    result = provider.get_spend_history({})
    assert "No rental history found." in result


def test_get_spend_history_api_error(provider):
    """Test get_spend_history action with API error."""
    # Setup mock to raise exception
    provider.billing.get_instance_history = Mock(side_effect=Exception("API Error"))

    # Call the method
    result = provider.get_spend_history({})
    assert "Error retrieving spend history: API Error" in result


def test_get_spend_history_invalid_response(provider):
    """Test get_spend_history action with invalid response format."""
    # Mock the service method to return an invalid response
    provider.billing.get_instance_history = Mock(side_effect=Exception("Invalid response"))

    # Call the method
    result = provider.get_spend_history({})
    assert "Error retrieving spend history: Invalid response" in result


def test_get_spend_history_malformed_instance(provider):
    """Test get_spend_history action with malformed instance data."""
    # Create a malformed instance entry
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
    
    # Mock the service method
    provider.billing.get_instance_history = Mock(
        return_value=InstanceHistoryResponse(instance_history=[instance_entry])
    )

    # Call the method
    result = provider.get_spend_history({})

    # Check that defaults are used
    assert "- instance-123:" in result
    assert "GPU: Unknown GPU (Count: 0)" in result
    assert "Duration: 3600 seconds" in result
    assert "Cost: $0.00" in result
