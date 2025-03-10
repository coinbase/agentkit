"""Tests for generate_text action in HyperbolicAIActionProvider."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.models import (
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatCompletionResponseMessage,
    ChatCompletionResponseUsage,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.schemas import (
    GenerateTextSchema,
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
    # Setup mock response
    mock_ai_service.generate_text.return_value = mock_response

    # Mock the save_text function
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_text"
    ) as mock_save_text:
        # Setup mock return value
        mock_file_path = "/tmp/generated_text_test.txt"
        mock_save_text.return_value = mock_file_path

        # Call the method with a dictionary
        args = {"prompt": "Test prompt"}
        result = provider.generate_text(args)

        # Verify the result is a string
        assert isinstance(result, str)

        # Check that the output contains the file path and preview
        assert "Text generated successfully" in result
        assert mock_file_path in result
        assert "Preview" in result

        # Verify save_text was called with the correct arguments
        mock_save_text.assert_called_once()
        text_arg, file_path_arg = mock_save_text.call_args[0]
        assert text_arg == "Generated text response."
        assert file_path_arg.startswith("./tmp/generated_text_")
        assert file_path_arg.endswith(".txt")


def test_generate_text_schema_validation():
    """Test validation of input schema."""
    # Test schema validation with missing prompt
    with pytest.raises(ValidationError):
        GenerateTextSchema(**{})

    # Test schema validation with empty prompt
    with pytest.raises(ValidationError):
        GenerateTextSchema(**{"prompt": ""})

    # Test validating with an actual prompt
    schema = GenerateTextSchema(**{"prompt": "Test prompt"})
    assert schema.prompt == "Test prompt"
    assert schema.model == "meta-llama/Meta-Llama-3-70B-Instruct"  # Default value


def test_generate_text_error(provider, mock_ai_service):
    """Test error handling in text generation."""
    # Setup mock to raise an exception
    mock_ai_service.generate_text.side_effect = Exception("API error")

    # Call the method
    args = {"prompt": "Test prompt"}
    result = provider.generate_text(args)

    # Verify the result is a string containing the error message
    assert isinstance(result, str)
    assert "Error generating text: API error" in result


def test_generate_text_saves_to_file(provider, mock_ai_service, mock_response, tmpdir):
    """Test that text generation saves the output to a file."""
    # Setup mock response
    mock_ai_service.generate_text.return_value = mock_response

    # Mock the save_text function
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_text"
    ) as mock_save_text:
        # Setup mock return value
        mock_file_path = os.path.join(tmpdir, "generated_text_test.txt")
        mock_save_text.return_value = mock_file_path

        # Call the method
        args = {"prompt": "Test prompt"}
        result = provider.generate_text(args)

        # Verify the result is a string
        assert isinstance(result, str)

        # Check that the output contains the file path and preview
        assert "Text generated successfully" in result
        assert mock_file_path in result
        assert "Preview" in result

        # Verify save_text was called with the correct arguments
        mock_save_text.assert_called_once()
        text_arg, file_path_arg = mock_save_text.call_args[0]
        assert text_arg == "Generated text response."
        assert file_path_arg.startswith("./tmp/generated_text_")
        assert file_path_arg.endswith(".txt")
