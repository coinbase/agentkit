"""Fixtures for billing service end-to-end tests."""

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.billing.service import BillingService


@pytest.fixture
def billing(api_key: str):
    """Create a Billing service instance for testing.

    Args:
        api_key: API key for authentication.

    Returns:
        Billing: A billing service instance initialized with the API key.

    """
    return BillingService(api_key)
