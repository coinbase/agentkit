"""Unit tests for Hyperbolic Billing service."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.constants import BILLING_BASE_URL
from coinbase_agentkit.action_providers.hyperboliclabs.billing.service import Billing


def test_billing_service_init(api_key):
    """Test Billing service initialization."""
    service = Billing(api_key)
    assert service.base_url == BILLING_BASE_URL


def test_billing_get_current_balance(mock_request, api_key):
    """Test get_balance method."""
    service = Billing(api_key)
    mock_request.return_value.json.return_value = {"credits": "1000.50"}

    response = service.get_balance()
    assert response.credits == "1000.50"
    mock_request.assert_called_once()


def test_billing_get_purchase_history(mock_request, api_key):
    """Test get_purchase_history method."""
    service = Billing(api_key)
    mock_request.return_value.json.return_value = {
        "purchase_history": [
            {
                "amount": "100.00", 
                "timestamp": "2024-01-01T00:00:00Z", 
                "source": "stripe_purchase"  # Added required source field
            }
        ]
    }

    response = service.get_purchase_history()
    assert len(response.purchase_history) == 1
    assert response.purchase_history[0].amount == "100.00"
    assert response.purchase_history[0].timestamp == "2024-01-01T00:00:00Z"
    assert response.purchase_history[0].source == "stripe_purchase"
    mock_request.assert_called_once()


def test_billing_service_error_handling(mock_request, api_key):
    """Test error handling in billing service."""
    service = Billing(api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("403 Forbidden: Insufficient credits")

    with pytest.raises(requests.exceptions.HTTPError, match="403 Forbidden"):
        service.get_balance()  # Updated method name 