"""Test fixtures for Hyperbolic marketplace service."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.service import Marketplace

# Test constants
TEST_API_KEY = ""
TEST_CLUSTER = "test-cluster"
TEST_NODE = "test-node"
TEST_GPU_COUNT = 2
TEST_INSTANCE_ID = "test-instance-id"


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
def marketplace():
    """Create a Marketplace service instance for testing.
    
    Returns:
        Marketplace: A marketplace service instance initialized with the test API key.
    """
    return Marketplace(TEST_API_KEY)
