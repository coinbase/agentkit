"""End-to-end tests for Hyperbolic billing service."""

import json
from datetime import datetime, timezone

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.billing.types import (
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

    if response.purchase_history:
        purchase = response.purchase_history[0]

        assert float(purchase.amount) > 0, "Purchase amount should be positive"
        assert (
            float(purchase.amount) <= 100000
        ), "Purchase amount should be within reasonable limits"
        assert round(float(purchase.amount), 2) == float(
            purchase.amount
        ), "Amount should have at most 2 decimal places"

        purchase_time = datetime.fromisoformat(purchase.timestamp)
        current_time = datetime.now(timezone.utc)
        assert purchase_time <= current_time, "Purchase time should not be in the future"

        assert purchase.source in [
            "signup_promo",
            "stripe_purchase",
        ], "Source should be a known value"
