"""Test fixtures for Hyperbolic billing service."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.billing.service import Billing

# Test constants
TEST_API_KEY = ""


@pytest.fixture
def mock_request():
    """Mock the request function for testing.
    
    Returns:
        MagicMock: A mock object that simulates the requests.request function.
    """
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.services.base.requests.request") as mock:
        mock.return_value.status_code = 200
        mock.return_value.json.return_value = {"status": "success"}
        yield mock


@pytest.fixture
def billing():
    """Create a Billing service instance for testing.
    
    Returns:
        Billing: A billing service instance initialized with the test API key.
    """
    return Billing(TEST_API_KEY) 