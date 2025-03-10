"""Fixtures for Allora action provider tests."""

from unittest.mock import AsyncMock, patch

import pytest
from allora_sdk.v2.api_client import ChainSlug

from coinbase_agentkit.action_providers.allora.allora_action_provider import AlloraActionProvider


@pytest.fixture
def mock_client():
    """Create a mock Allora API client."""
    with patch("allora_sdk.v2.api_client.AlloraAPIClient") as mock:
        yield mock


@pytest.fixture
def provider(mock_client):
    """Create an Allora action provider with a mock client."""
    provider = AlloraActionProvider(api_key="test-api-key", chain_slug=ChainSlug.TESTNET)
    provider.client = mock_client.return_value

    # Instead of mocking _run_async, we'll patch it to directly return the value
    # that would be returned by the coroutine
    def mock_run_async(coro):
        # For AsyncMock objects, we need to access their return_value
        if isinstance(coro, AsyncMock):
            return coro.return_value
        # For AsyncMock with side_effect=Exception, we need to raise the exception
        try:
            return coro
        except Exception as e:
            raise e

    provider._run_async = mock_run_async
    return provider
