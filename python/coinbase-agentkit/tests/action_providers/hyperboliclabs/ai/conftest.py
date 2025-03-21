"""Test fixtures for Hyperbolic AI service."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider import AIActionProvider


@pytest.fixture
def mock_ai_service():
    """Create a mock AIService for testing.

    Returns:
        MagicMock: A mock object that simulates the AIService.

    """
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.AIService"
    ) as mock:
        yield mock.return_value


@pytest.fixture
def provider(mock_api_key, mock_ai_service):
    """Create a HyperbolicAIActionProvider with a mock API key and service.

    Args:
        mock_api_key: Mock API key for authentication.
        mock_ai_service: Mock AIService to use in the provider.

    Returns:
        HyperbolicAIActionProvider: Provider with mock API key and service.

    """
    provider = AIActionProvider(api_key=mock_api_key)
    provider.ai_service = mock_ai_service
    return provider
