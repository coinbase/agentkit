"""End-to-end tests for Hyperbolic billing service."""

import json
from datetime import datetime, timezone

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.billing.models import (
    BillingBalanceResponse,
    BillingPurchaseHistoryResponse,
)


@pytest.mark.e2e
def test_billing_balance(billing):
    """Test getting current balance."""
    response = billing.get_balance()
    print("\nBalance response:", json.dumps(response.model_dump(), indent=2))

    assert isinstance(response, BillingBalanceResponse)
    assert isinstance(response.credits, int | str)
    if isinstance(response.credits, str):
        assert float(response.credits) >= 0
    else:
        assert response.credits >= 0


@pytest.mark.e2e
def test_billing_history(billing):
    """Test getting purchase history."""
    response = billing.get_purchase_history()
    print("\nPurchase history response:", json.dumps(response.model_dump(), indent=2))

    assert isinstance(response, BillingPurchaseHistoryResponse)
    assert isinstance(response.purchase_history, list)

    # If there is purchase history, validate entry structure and constraints
    if response.purchase_history:
        purchase = response.purchase_history[0]

        # Validate amount constraints
        assert float(purchase.amount) > 0, "Purchase amount should be positive"
        assert (
            float(purchase.amount) <= 100000
        ), "Purchase amount should be within reasonable limits"
        assert round(float(purchase.amount), 2) == float(
            purchase.amount
        ), "Amount should have at most 2 decimal places"

        # API returns timestamps in format: "2025-03-06 07:26:08.969381+00:00"
        # datetime.fromisoformat() handles this format natively since Python 3.7
        purchase_time = datetime.fromisoformat(purchase.timestamp)
        current_time = datetime.now(timezone.utc)
        assert purchase_time <= current_time, "Purchase time should not be in the future"

        # Validate source field
        assert purchase.source in [
            "signup_promo",
            "stripe_purchase",
        ], "Source should be a known value"
