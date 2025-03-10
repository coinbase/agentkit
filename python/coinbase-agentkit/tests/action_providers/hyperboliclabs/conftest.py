"""Common test fixtures for Hyperbolic services."""

import os
from unittest.mock import patch

import pytest


@pytest.fixture
def api_key() -> str:
    """Get API key for testing.

    Returns:
        str: API key from environment.

    Skips the test if HYPERBOLIC_API_KEY is not set.

    """
    api_key = os.environ.get("HYPERBOLIC_API_KEY", "")
    if not api_key:
        pytest.skip("HYPERBOLIC_API_KEY environment variable not set")
    return api_key


@pytest.fixture
def mock_api_key():
    """Mock API key for testing."""
    return "test-api-key"


@pytest.fixture
def mock_request():
    """Mock requests for all tests."""
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.service.requests.request"
    ) as mock:
        mock.return_value.status_code = 200
        mock.return_value.json.return_value = {"status": "success"}
        mock.return_value.raise_for_status.return_value = None
        yield mock
