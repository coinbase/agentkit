"""Tests for generate_text action in HyperbolicAIActionProvider."""

from unittest.mock import patch, Mock
import json

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider import (
    AIActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.schemas import (
    GenerateTextSchema,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.models import (
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatCompletionResponseMessage,
    ChatCompletionResponseUsage,
)


@pytest.fixture
def mock_ai_service():
    """Create a mock AIService."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.AIService") as mock:
        yield mock.return_value


@pytest.fixture
def provider():
    """Create a HyperbolicAIActionProvider with a test API key."""
    return AIActionProvider(api_key="test-api-key")


def test_generate_text_success(provider, mock_ai_service, monkeypatch):
    """Test successful text generation."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock response
    mock_response = ChatCompletionResponse(
        id="chat-12345",
        object="chat.completion",
        created=1677858242,
        model="meta-llama/Meta-Llama-3-70B-Instruct",
        choices=[
            ChatCompletionResponseChoice(
                index=0,
                message=ChatCompletionResponseMessage(
                    role="assistant",
                    content="Generated text response",
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
    mock_ai_service.generate_text.return_value = mock_response

    # Call the method with a dictionary
    args = {"prompt": "Test prompt"}
    result = provider.generate_text(args)

    # Verify the result is a string
    assert isinstance(result, str)
    
    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert result_json["id"] == "chat-12345"
    assert result_json["model"] == "meta-llama/Meta-Llama-3-70B-Instruct"
    assert len(result_json["choices"]) == 1
    assert result_json["choices"][0]["message"]["content"] == "Generated text response"
    assert result_json["usage"]["total_tokens"] == 30

    # Verify the mock was called correctly
    mock_ai_service.generate_text.assert_called_once()
    request = mock_ai_service.generate_text.call_args[0][0]
    assert request.messages[0].content == "Test prompt"
    assert request.model == "meta-llama/Meta-Llama-3-70B-Instruct"


def test_generate_text_with_custom_model(provider, mock_ai_service, monkeypatch):
    """Test text generation with a custom model."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock response
    mock_response = ChatCompletionResponse(
        id="chat-12345",
        object="chat.completion",
        created=1677858242,
        model="meta-llama/Meta-Llama-3-8B-Instruct",
        choices=[
            ChatCompletionResponseChoice(
                index=0,
                message=ChatCompletionResponseMessage(
                    role="assistant",
                    content="Generated text response",
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
    mock_ai_service.generate_text.return_value = mock_response

    # Call the method with custom model
    args = {
        "prompt": "Test prompt",
        "model": "meta-llama/Meta-Llama-3-8B-Instruct"
    }
    result = provider.generate_text(args)

    # Verify the result is a string
    assert isinstance(result, str)
    
    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert result_json["model"] == "meta-llama/Meta-Llama-3-8B-Instruct"

    # Verify the mock was called correctly
    request = mock_ai_service.generate_text.call_args[0][0]
    assert request.model == "meta-llama/Meta-Llama-3-8B-Instruct"


def test_generate_text_schema_validation():
    """Test schema validation for generate_text."""
    # Test with valid data
    valid_data = {"prompt": "Test prompt"}
    schema = GenerateTextSchema(**valid_data)
    assert schema.prompt == "Test prompt"
    assert schema.model == "meta-llama/Meta-Llama-3-70B-Instruct"  # Default value

    # Test with custom model
    custom_model_data = {"prompt": "Test prompt", "model": "custom-model"}
    schema = GenerateTextSchema(**custom_model_data)
    assert schema.prompt == "Test prompt"
    assert schema.model == "custom-model"

    # Test with missing required field
    with pytest.raises(ValidationError):
        GenerateTextSchema()


def test_generate_text_error(provider, mock_ai_service, monkeypatch):
    """Test text generation with error."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock to raise exception
    mock_ai_service.generate_text.side_effect = Exception("API error")

    # Call the method
    args = {"prompt": "Test prompt"}
    result = provider.generate_text(args)

    # Verify the result is a string
    assert isinstance(result, str)
    assert "Error generating text: API error" in result 