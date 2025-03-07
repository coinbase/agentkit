"""Test fixtures for Hyperbolic AI service."""

import os
from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.ai.service import AIService

# Test constants
TEST_API_KEY = ""


@pytest.fixture
def api_key() -> str:
    """Get API key for testing.
    
    Returns:
        str: API key from environment or default test key.
    """
    return os.environ.get("HYPERBOLIC_API_KEY", TEST_API_KEY)


@pytest.fixture
def ai_service(api_key: str) -> AIService:
    """Create AIService instance for testing.
    
    Args:
        api_key: API key for authentication.
        
    Returns:
        AIService: Instance of AIService for testing.
    """
    return AIService(api_key)


@pytest.fixture
def mock_request():
    """Mock requests for all tests."""
    with patch("requests.request") as mock:
        mock.return_value.json.return_value = {"status": "success"}
        mock.return_value.raise_for_status.return_value = None
        yield mock 