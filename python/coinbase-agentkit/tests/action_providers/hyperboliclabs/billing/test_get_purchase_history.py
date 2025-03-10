"""Tests for get_purchase_history action in BillingActionProvider."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.billing import (
    BillingActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.billing.models import (
    BillingPurchaseHistoryEntry,
    BillingPurchaseHistoryResponse,
)


@pytest.fixture
def provider(mock_api_key):
    """Create BillingActionProvider instance for testing."""
    return BillingActionProvider(api_key=mock_api_key)


def test_get_purchase_history_success(provider):
    """Test successful get_purchase_history action."""
    # Create purchase history entries
    purchase_entries = [
        BillingPurchaseHistoryEntry(
            amount="10000",
            timestamp="2024-01-15T12:00:00+00:00",
            source="stripe_purchase",
        ),
        BillingPurchaseHistoryEntry(
            amount="5000",
            timestamp="2023-12-30T15:30:00+00:00",
            source="stripe_purchase",
        ),
        BillingPurchaseHistoryEntry(
            amount="7500",
            timestamp="2023-11-20T10:45:00+00:00",
            source="stripe_purchase",
        ),
    ]

    provider.billing.get_purchase_history = Mock(
        return_value=BillingPurchaseHistoryResponse(purchase_history=purchase_entries)
    )

    # Call the method
    result = provider.get_purchase_history({})

    # Check the response formatting
    assert "Purchase History (showing 5 most recent):" in result
    assert "$100.00 on January 15, 2024" in result
    assert "$50.00 on December 30, 2023" in result
    assert "$75.00 on November 20, 2023" in result


def test_get_purchase_history_empty(provider):
    """Test get_purchase_history action with empty purchase history."""
    # Mock the service method
    provider.billing.get_purchase_history = Mock(
        return_value=BillingPurchaseHistoryResponse(purchase_history=[])
    )

    # Call the method
    result = provider.get_purchase_history({})
    assert "No previous purchases found" in result


def test_get_purchase_history_api_error(provider):
    """Test get_purchase_history action with API error."""
    # Setup mock to raise exception
    provider.billing.get_purchase_history = Mock(side_effect=Exception("API Error"))

    # Call the method
    result = provider.get_purchase_history({})
    assert "Error retrieving purchase history: API Error" in result
