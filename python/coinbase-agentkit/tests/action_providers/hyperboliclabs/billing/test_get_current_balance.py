"""Tests for get_current_balance action in HyperbolicBillingActionProvider."""

from unittest.mock import Mock

from coinbase_agentkit.action_providers.hyperboliclabs.billing.types import (
    BillingBalanceResponse,
)


def test_get_current_balance_success(provider):
    """Test successful get_current_balance action."""
    provider.billing.get_balance = Mock(return_value=BillingBalanceResponse(credits="15000"))

    result = provider.get_current_balance({})

    assert "Your current Hyperbolic platform balance is $150.00" in result


def test_get_current_balance_empty_history(provider):
    """Test get_current_balance action with empty purchase history."""
    provider.billing.get_balance = Mock(return_value=BillingBalanceResponse(credits="0"))

    result = provider.get_current_balance({})
    assert "Your current Hyperbolic platform balance is $0.00" in result


def test_get_current_balance_api_error(provider):
    """Test get_current_balance action with API error."""
    provider.billing.get_balance = Mock(side_effect=Exception("API Error"))

    result = provider.get_current_balance({})
    assert "Error: Balance retrieval: API Error" in result
