"""Fixtures for Allora action provider tests."""

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from allora_sdk.v2.api_client import ChainSlug

# Add the project root to the Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from coinbase_agentkit.action_providers.allora.allora_action_provider import (  # noqa: E402
    AlloraActionProvider,
)


def pytest_configure(config):
    """Register the integration marker."""
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test that requires internet connection"
    )


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


@pytest.fixture
def integration_provider():
    """Create an Allora action provider for integration tests.

    This uses the default API key and testnet configuration from the AlloraActionProvider class.
    If you want to use custom values, you can set the ALLORA_API_KEY and ALLORA_CHAIN_SLUG
    environment variables.
    """
    # Get optional custom values from environment variables
    api_key = os.environ.get("ALLORA_API_KEY")

    chain_slug = None
    chain_slug_str = os.environ.get("ALLORA_CHAIN_SLUG")
    if chain_slug_str and chain_slug_str.lower() == "mainnet":
        chain_slug = ChainSlug.MAINNET

    # Create the provider with optional custom values (will use defaults if None)
    return AlloraActionProvider(api_key=api_key, chain_slug=chain_slug)
