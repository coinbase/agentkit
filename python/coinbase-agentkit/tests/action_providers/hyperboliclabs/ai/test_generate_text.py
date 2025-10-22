"""Tests for generate_text action in HyperbolicAIActionProvider."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.schemas import (
    GenerateTextSchema,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.types import (
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatCompletionResponseMessage,
    ChatCompletionResponseUsage,
)


@pytest.fixture
def mock_response():
    """Create a standard mock response."""
    return ChatCompletionResponse(
        id="chat-12345",
        object="chat.completion",
        created=1677858242,
        model="meta-llama/Meta-Llama-3-70B-Instruct",
        choices=[
            ChatCompletionResponseChoice(
                index=0,
                message=ChatCompletionResponseMessage(
                    role="assistant",
                    content="Generated text response.",
                ),
                finish_reason="stop",
            )
        ],
        usage=ChatCompletionResponseUsage(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30,
        ),
    )


def test_generate_text_success(provider, mock_ai_service, mock_response):
    """Test successful text generation."""
    mock_ai_service.generate_text.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_text"
    ) as mock_save_text:
        mock_file_path = "/tmp/generated_text_test.txt"
        mock_save_text.return_value = mock_file_path

        args = {"prompt": "Test prompt"}
        result = provider.generate_text(args)

        assert isinstance(result, str)

        assert "Text generation successful:" in result
        assert mock_file_path in result
        assert "Preview" in result

        mock_save_text.assert_called_once()
        text_arg, file_path_arg = mock_save_text.call_args[0]
        assert text_arg == "Generated text response."
        assert file_path_arg.startswith("./tmp/generated_text_")
        assert file_path_arg.endswith(".txt")


def test_generate_text_schema_validation():
    """Test validation of input schema."""
    with pytest.raises(ValidationError):
        GenerateTextSchema(**{})

    with pytest.raises(ValidationError):
        GenerateTextSchema(**{"prompt": ""})

    schema = GenerateTextSchema(**{"prompt": "Test prompt"})
    assert schema.prompt == "Test prompt"
    assert schema.model == "meta-llama/Meta-Llama-3-70B-Instruct"


def test_generate_text_error(provider, mock_ai_service):
    """Test error handling in text generation."""
    mock_ai_service.generate_text.side_effect = Exception("API error")

    args = {"prompt": "Test prompt"}
    result = provider.generate_text(args)

    assert isinstance(result, str)
    assert "Error: Text generation: API error" in result


def test_generate_text_saves_to_file(provider, mock_ai_service, mock_response, tmpdir):
    """Test that text generation saves the output to a file."""
    mock_ai_service.generate_text.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_text"
    ) as mock_save_text:
        mock_file_path = os.path.join(tmpdir, "generated_text_test.txt")
        mock_save_text.return_value = mock_file_path

        args = {"prompt": "Test prompt"}
        result = provider.generate_text(args)

        assert isinstance(result, str)

        assert "Text generation successful:" in result
        assert mock_file_path in result
        assert "Preview" in result

        mock_save_text.assert_called_once()
        text_arg, file_path_arg = mock_save_text.call_args[0]
        assert text_arg == "Generated text response."
        assert file_path_arg.startswith("./tmp/generated_text_")
        assert file_path_arg.endswith(".txt")
