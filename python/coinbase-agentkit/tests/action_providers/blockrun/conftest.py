"""Test fixtures for BlockRun action provider."""

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing.

    The wallet provider has a to_signer() method that returns a signer
    object compatible with the x402 library.
    """
    mock_provider = MagicMock()
    mock_signer = MagicMock()
    mock_signer.address = "0x1234567890123456789012345678901234567890"
    mock_provider.to_signer.return_value = mock_signer
    mock_provider.get_address.return_value = "0x1234567890123456789012345678901234567890"
    return mock_provider


@pytest.fixture
def mock_x402_session():
    """Create a mock x402 session for testing."""
    mock_session = MagicMock()

    # Setup mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "openai/gpt-4o-mini",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "This is a test response from the LLM.",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
        },
    }
    mock_response.raise_for_status = MagicMock()

    mock_session.post.return_value = mock_response
    mock_session.get.return_value = mock_response

    return mock_session


@pytest.fixture
def provider(mock_x402_session):
    """Create a BlockrunActionProvider with mocked x402 session.

    Args:
        mock_x402_session: Mock x402 session for HTTP requests.

    Returns:
        BlockrunActionProvider: Provider configured for testing.

    """
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session
        provider = BlockrunActionProvider()
        # Store the mock for use in tests
        provider._mock_x402_requests = mock_x402_requests
        provider._mock_session = mock_x402_session
        yield provider
