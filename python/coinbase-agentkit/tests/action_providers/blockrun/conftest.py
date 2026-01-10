"""Test fixtures for BlockRun action provider."""

import os
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_wallet_key():
    """Mock wallet key for testing."""
    return "0x" + "a" * 64


@pytest.fixture
def real_wallet_key():
    """Real wallet key for e2e testing.

    Returns:
        str: Wallet key from environment.

    Skips the test if BLOCKRUN_WALLET_KEY is not set.
    """
    wallet_key = os.environ.get("BLOCKRUN_WALLET_KEY", "")
    if not wallet_key:
        pytest.skip("BLOCKRUN_WALLET_KEY environment variable not set")
    return wallet_key


@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock_provider = MagicMock()
    mock_provider._account = MagicMock()
    mock_provider._account.key = MagicMock()
    mock_provider._account.key.hex.return_value = "0x" + "b" * 64
    return mock_provider


@pytest.fixture
def mock_llm_client():
    """Create a mock LLMClient for testing."""
    mock_client = MagicMock()

    # Setup mock chat_completion response
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "This is a test response from the LLM."
    mock_response.usage = MagicMock()
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 20
    mock_response.usage.total_tokens = 30
    mock_client.chat_completion.return_value = mock_response

    return mock_client


@pytest.fixture
def provider(mock_wallet_key, mock_llm_client):
    """Create a BlockrunActionProvider with a mock wallet key and client.

    Args:
        mock_wallet_key: Mock wallet key for authentication.
        mock_llm_client: Mock LLMClient to use in the provider.

    Returns:
        BlockrunActionProvider: Provider with mock wallet key and client.
    """
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)
    provider._client = mock_llm_client
    return provider
