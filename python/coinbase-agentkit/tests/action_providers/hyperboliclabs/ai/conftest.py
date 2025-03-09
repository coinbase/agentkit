"""Test fixtures for Hyperbolic AI service."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.ai.service import AIService
from coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider import HyperbolicAIActionProvider


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
def mock_ai_service():
    """Create a mock AIService for testing.
    
    Returns:
        MagicMock: A mock object that simulates the AIService.
    """
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.AIService") as mock:
        yield mock.return_value


@pytest.fixture
def provider(mock_ai_service):
    """Create a HyperbolicAIActionProvider with a test API key and mock service.
    
    Args:
        mock_ai_service: Mock AIService to use in the provider.
        
    Returns:
        HyperbolicAIActionProvider: Provider with mock service.
    """
    provider = HyperbolicAIActionProvider(api_key="test-api-key")
    provider.ai_service = mock_ai_service
    return provider


@pytest.fixture
def mock_request():
    """Mock requests for all tests."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.service.requests.request") as mock:
        mock.return_value.json.return_value = {"status": "success"}
        mock.return_value.raise_for_status.return_value = None
        yield mock 