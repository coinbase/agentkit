"""Tests for get_purchase_history action in BillingActionProvider."""

from unittest.mock import Mock

from coinbase_agentkit.action_providers.hyperboliclabs.billing.types import (
    BillingPurchaseHistoryEntry,
    BillingPurchaseHistoryResponse,
)


def test_get_purchase_history_success(provider):
    """Test successful get_purchase_history action."""
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

    result = provider.get_purchase_history({})

    assert "Purchase History (showing 5 most recent):" in result
    assert "$100.00 on January 15, 2024" in result
    assert "$50.00 on December 30, 2023" in result
    assert "$75.00 on November 20, 2023" in result


def test_get_purchase_history_empty(provider):
    """Test get_purchase_history action with empty purchase history."""
    provider.billing.get_purchase_history = Mock(
        return_value=BillingPurchaseHistoryResponse(purchase_history=[])
    )

    result = provider.get_purchase_history({})
    assert "No previous purchases found" in result


def test_get_purchase_history_api_error(provider):
    """Test get_purchase_history action with API error."""
    provider.billing.get_purchase_history = Mock(side_effect=Exception("API Error"))

    result = provider.get_purchase_history({})
    assert "Error: Purchase history retrieval: API Error" in result
