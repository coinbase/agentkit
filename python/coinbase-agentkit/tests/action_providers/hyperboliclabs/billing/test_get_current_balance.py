"""Tests for get_current_balance action in HyperbolicBillingActionProvider."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.billing import (
    BillingActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.billing.models import (
    BillingBalanceResponse,
    BillingPurchaseHistoryEntry,
    BillingPurchaseHistoryResponse,
)


@pytest.fixture
def provider(mock_api_key):
    """Create BillingActionProvider instance for testing."""
    return BillingActionProvider(api_key=mock_api_key)


def test_get_current_balance_success(provider):
    """Test successful get_current_balance action."""
    # Mock the service methods
    provider.billing.get_balance = Mock(return_value=BillingBalanceResponse(credits="15000"))

    # Call the method
    result = provider.get_current_balance({})

    # Check the response formatting
    assert "Your current Hyperbolic platform balance is $150.00" in result


def test_get_current_balance_empty_history(provider):
    """Test get_current_balance action with empty purchase history."""
    # Mock the service methods
    provider.billing.get_balance = Mock(return_value=BillingBalanceResponse(credits="0"))
    
    # Call the method
    result = provider.get_current_balance({})
    assert "Your current Hyperbolic platform balance is $0.00" in result


def test_get_current_balance_api_error(provider):
    """Test get_current_balance action with API error."""
    # Setup mock to raise exception
    provider.billing.get_balance = Mock(side_effect=Exception("API Error"))

    # Call the method
    result = provider.get_current_balance({})
    assert "Error retrieving balance information: API Error" in result
