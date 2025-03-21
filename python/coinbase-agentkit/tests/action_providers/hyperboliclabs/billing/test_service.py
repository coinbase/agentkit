"""Unit tests for Hyperbolic Billing service."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.billing.service import BillingService
from coinbase_agentkit.action_providers.hyperboliclabs.constants import (
    BILLING_BASE_URL,
    BILLING_ENDPOINTS,
)


def test_billing_service_init(mock_api_key):
    """Test Billing service initialization."""
    service = BillingService(mock_api_key)
    assert service.base_url == BILLING_BASE_URL


def test_billing_get_current_balance(mock_request, mock_api_key):
    """Test get_balance method."""
    service = BillingService(mock_api_key)
    mock_request.return_value.json.return_value = {"credits": "1000.50"}

    response = service.get_balance()
    assert response.credits == "1000.50"

    mock_request.assert_called_with(
        method="GET",
        url=f"{BILLING_BASE_URL}{BILLING_ENDPOINTS['GET_BALANCE']}",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {mock_api_key}"},
        json=None,
        params=None,
    )


def test_billing_get_purchase_history(mock_request, mock_api_key):
    """Test get_purchase_history method."""
    service = BillingService(mock_api_key)
    mock_request.return_value.json.return_value = {
        "purchase_history": [
            {
                "amount": "100.00",
                "timestamp": "2024-01-01T00:00:00Z",
                "source": "stripe_purchase",
            }
        ]
    }

    response = service.get_purchase_history()
    assert len(response.purchase_history) == 1
    assert response.purchase_history[0].amount == "100.00"
    assert response.purchase_history[0].timestamp == "2024-01-01T00:00:00Z"
    assert response.purchase_history[0].source == "stripe_purchase"

    mock_request.assert_called_with(
        method="GET",
        url=f"{BILLING_BASE_URL}{BILLING_ENDPOINTS['PURCHASE_HISTORY']}",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {mock_api_key}"},
        json=None,
        params=None,
    )


def test_billing_service_error_handling(mock_request, mock_api_key):
    """Test error handling in billing service."""
    service = BillingService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("403 Forbidden: Insufficient credits")

    with pytest.raises(requests.exceptions.HTTPError, match="403 Forbidden"):
        service.get_balance()

    mock_request.reset_mock()
    mock_request.side_effect = requests.exceptions.HTTPError("500 Internal Server Error")

    with pytest.raises(requests.exceptions.HTTPError, match="500 Internal Server Error"):
        service.get_purchase_history()
