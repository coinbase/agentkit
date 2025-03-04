"""Tests for the get_current_balance action."""

from unittest.mock import patch
from decimal import Decimal

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.schemas import GetCurrentBalanceSchema

from .conftest import MOCK_API_KEY


def test_get_current_balance_schema_valid():
    """Test that GetCurrentBalanceSchema is valid with no parameters."""
    schema = GetCurrentBalanceSchema()
    assert isinstance(schema, GetCurrentBalanceSchema)


def test_get_current_balance_success(hyperbolic_provider):
    """Test successful get_current_balance with valid response."""
    # Mock balance info
    mock_balance_info = {
        "balance": 15000,  # $150.00 in cents
        "purchase_history": [
            {"amount": 10000, "date": "2024-01-15T12:00:00Z"},  # $100.00
            {"amount": 5000, "date": "2023-12-30T12:00:00Z"},   # $50.00
        ]
    }

    # Mock the get_balance_info function
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.get_balance_info") as mock_get_balance:
        mock_get_balance.return_value = mock_balance_info

        # Call the action
        result = hyperbolic_provider.get_current_balance({})

        # Verify the result
        assert "Your current Hyperbolic platform balance is $150.00" in result
        assert "Purchase History:" in result
        assert "$100.00 on January 15, 2024" in result
        assert "$50.00 on December 30, 2023" in result

        # Verify the function call
        mock_get_balance.assert_called_once_with(MOCK_API_KEY)


def test_get_current_balance_empty_history(hyperbolic_provider):
    """Test get_current_balance with empty purchase history."""
    # Mock balance info with empty purchase history
    mock_balance_info = {
        "balance": 15000,  # $150.00 in cents
        "purchase_history": []
    }

    # Mock the get_balance_info function
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.get_balance_info") as mock_get_balance:
        mock_get_balance.return_value = mock_balance_info

        # Call the action
        result = hyperbolic_provider.get_current_balance({})

        # Verify the result
        assert "Your current Hyperbolic platform balance is $150.00" in result
        assert "No purchase history found" in result

        # Verify the function call
        mock_get_balance.assert_called_once_with(MOCK_API_KEY)


def test_get_current_balance_error(hyperbolic_provider):
    """Test error handling in get_current_balance."""
    # Mock API error
    error_message = "API request failed"
    
    # Mock the get_balance_info function to raise an exception
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.get_balance_info") as mock_get_balance:
        mock_get_balance.side_effect = Exception(error_message)

        # Call the action
        result = hyperbolic_provider.get_current_balance({})

        # Verify the result
        assert result == f"Error retrieving balance information: {error_message}" 