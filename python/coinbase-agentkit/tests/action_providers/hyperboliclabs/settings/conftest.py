"""Test fixtures for Hyperbolic settings service."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.settings.service import Settings


@pytest.fixture
def mock_request():
    """Mock the request function for testing.
    
    Returns:
        MagicMock: A mock object that simulates the requests.request function.
    """
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.service.requests.request") as mock:
        mock.return_value.status_code = 200
        mock.return_value.json.return_value = {"status": "success"}
        yield mock


@pytest.fixture
def settings(api_key: str):
    """Create a Settings service instance for testing.
    
    Args:
        api_key: API key for authentication.
    
    Returns:
        Settings: A settings service instance initialized with the API key.
    """
    return Settings(api_key)
