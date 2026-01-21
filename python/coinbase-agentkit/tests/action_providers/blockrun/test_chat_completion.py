"""Tests for BlockRun chat_completion action."""

import json
from unittest.mock import patch


def test_chat_completion_basic(mock_wallet_provider, mock_x402_session):
    """Test basic chat completion request."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {"prompt": "Hello, how are you?"}

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["success"] is True
        assert "response" in result_data
        assert result_data["model"] == "openai/gpt-4o-mini"  # default model
        assert "payment" in result_data

        # Verify the session.post was called with correct URL
        mock_x402_session.post.assert_called_once()
        call_args = mock_x402_session.post.call_args
        assert "chat/completions" in call_args[0][0]


def test_chat_completion_with_model(mock_wallet_provider, mock_x402_session):
    """Test chat completion with specific model."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {
            "prompt": "Explain quantum computing",
            "model": "anthropic/claude-sonnet-4",
        }

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["success"] is True
        assert result_data["model"] == "anthropic/claude-sonnet-4"

        # Verify the model was passed in the request
        call_args = mock_x402_session.post.call_args
        assert call_args[1]["json"]["model"] == "anthropic/claude-sonnet-4"


def test_chat_completion_with_system_prompt(mock_wallet_provider, mock_x402_session):
    """Test chat completion with system prompt."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {
            "prompt": "Write a haiku",
            "system_prompt": "You are a creative poet.",
        }

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["success"] is True

        # Verify system prompt was included in messages
        call_args = mock_x402_session.post.call_args
        messages = call_args[1]["json"]["messages"]
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == "You are a creative poet."
        assert messages[1]["role"] == "user"


def test_chat_completion_with_parameters(mock_wallet_provider, mock_x402_session):
    """Test chat completion with all parameters."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {
            "prompt": "Tell me a joke",
            "model": "openai/gpt-4o",
            "system_prompt": "You are a comedian.",
            "max_tokens": 500,
            "temperature": 0.9,
        }

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["success"] is True
        assert result_data["model"] == "openai/gpt-4o"

        # Verify all parameters were passed
        call_args = mock_x402_session.post.call_args
        request_json = call_args[1]["json"]
        assert request_json["max_tokens"] == 500
        assert request_json["temperature"] == 0.9


def test_chat_completion_includes_usage(mock_wallet_provider, mock_x402_session):
    """Test that chat completion includes token usage."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {"prompt": "Hello"}

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["success"] is True
        assert "usage" in result_data
        assert result_data["usage"]["prompt_tokens"] == 10
        assert result_data["usage"]["completion_tokens"] == 20
        assert result_data["usage"]["total_tokens"] == 30


def test_chat_completion_error_handling(mock_wallet_provider, mock_x402_session):
    """Test chat completion error handling."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    # Make the session raise an exception
    mock_x402_session.post.side_effect = Exception("API error")

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {"prompt": "Hello"}

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["error"] is True
        assert "API error" in result_data["message"]
        assert "suggestion" in result_data


def test_chat_completion_payment_error(mock_wallet_provider, mock_x402_session):
    """Test chat completion with payment error."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    # Make the session raise a payment error
    mock_x402_session.post.side_effect = Exception("402 Payment Required")

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {"prompt": "Hello"}

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["error"] is True
        assert "USDC" in result_data["suggestion"]


def test_chat_completion_uses_wallet_provider_signer(mock_wallet_provider, mock_x402_session):
    """Test that chat completion uses wallet provider's signer for x402."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {"prompt": "Hello"}

        provider.chat_completion(mock_wallet_provider, args)

        # Verify wallet provider's to_signer was called
        mock_wallet_provider.to_signer.assert_called_once()

        # Verify x402_requests was called with the signer
        mock_x402_requests.assert_called_once()
        signer_arg = mock_x402_requests.call_args[0][0]
        assert signer_arg == mock_wallet_provider.to_signer.return_value
