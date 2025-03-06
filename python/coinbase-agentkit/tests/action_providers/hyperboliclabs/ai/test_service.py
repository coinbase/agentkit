"""Unit tests for Hyperbolic AI service."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.ai.service import AIService
from coinbase_agentkit.action_providers.hyperboliclabs.ai.types import (
    AudioGenerationRequest,
    ChatCompletionRequest,
    ChatMessage,
    ImageGenerationRequest,
)
from coinbase_agentkit.action_providers.hyperboliclabs.constants import (
    AI_SERVICES_BASE_URL,
    SUPPORTED_IMAGE_MODELS,
)


def test_ai_service_init(mock_api_key):
    """Test AI service initialization."""
    service = AIService(mock_api_key)
    assert service.base_url == AI_SERVICES_BASE_URL


def test_ai_text_generation(mock_request, mock_api_key):
    """Test text generation with different message types."""
    service = AIService(mock_api_key)
    model = "meta-llama/Meta-Llama-3-70B-Instruct"

    mock_request.return_value.json.return_value = {
        "id": "chat-12345",
        "object": "chat.completion",
        "created": 1677858242,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Generated text response",
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

    request = ChatCompletionRequest(
        messages=[ChatMessage(role="user", content="Test prompt")],
        model=model,
    )
    response = service.generate_text(request)
    assert response.id == "chat-12345"
    assert response.model == model
    assert len(response.choices) == 1
    assert response.choices[0].message.content == "Generated text response"
    assert response.usage.total_tokens == 30

    request = ChatCompletionRequest(
        messages=[
            ChatMessage(role="system", content="You are a helpful assistant."),
            ChatMessage(role="user", content="What is 2+2?"),
        ],
        model=model,
    )
    response = service.generate_text(request)
    assert response.id == "chat-12345"
    assert response.model == model
    assert len(response.choices) == 1
    assert response.choices[0].message.role == "assistant"
    assert response.usage.total_tokens == 30


def test_ai_image_generation(mock_request, mock_api_key):
    """Test image generation with different parameters."""
    service = AIService(mock_api_key)
    model = SUPPORTED_IMAGE_MODELS[0]

    mock_request.return_value.json.return_value = {
        "images": [
            {
                "image": "base64_encoded_image_data",
                "random_seed": 12345,
                "index": 0,
            }
        ],
        "inference_time": 1.5,
    }

    request = ImageGenerationRequest(
        prompt="Test prompt",
        model_name=model,
        height=1024,
        width=1024,
    )
    response = service.generate_image(request)
    assert len(response.images) == 1
    assert response.images[0].image == "base64_encoded_image_data"
    assert response.images[0].random_seed == 12345
    assert response.inference_time == 1.5

    request = ImageGenerationRequest(
        prompt="Test prompt with options",
        model_name=model,
        height=512,
        width=512,
        steps=20,
        num_images=2,
        negative_prompt="low quality",
        seed=12345,
        cfg_scale=7.5,
    )

    mock_request.return_value.json.return_value = {
        "images": [
            {
                "image": "base64_encoded_image_data_1",
                "random_seed": 12345,
                "index": 0,
            },
            {
                "image": "base64_encoded_image_data_2",
                "random_seed": 12346,
                "index": 1,
            },
        ],
        "inference_time": 2.5,
    }

    response = service.generate_image(request)
    assert len(response.images) == 2
    assert response.images[0].image == "base64_encoded_image_data_1"
    assert response.images[1].image == "base64_encoded_image_data_2"
    assert response.inference_time == 2.5


def test_ai_audio_generation(mock_request, mock_api_key):
    """Test audio generation with different parameters."""
    service = AIService(mock_api_key)
    speaker = "EN-US"
    language = "EN"

    mock_request.return_value.json.return_value = {
        "audio": "base64_encoded_audio_data",
        "duration": 3.5,
    }

    request = AudioGenerationRequest(
        text="Test text",
        speaker=speaker,
        language=language,
    )
    response = service.generate_audio(request)
    assert response.audio == "base64_encoded_audio_data"
    assert response.duration == 3.5

    request = AudioGenerationRequest(
        text="Test text with options",
        language=language,
        speaker=speaker,
        sdp_ratio=0.5,
        noise_scale=0.6,
        noise_scale_w=0.7,
        speed=1.2,
    )
    response = service.generate_audio(request)
    assert response.audio == "base64_encoded_audio_data"
    assert response.duration == 3.5


def test_ai_service_error_handling(mock_request, mock_api_key):
    """Test error handling in AI service."""
    service = AIService(mock_api_key)

    mock_request.side_effect = requests.exceptions.HTTPError(
        "400 Bad Request: Invalid model specified"
    )
    with pytest.raises(requests.exceptions.HTTPError, match="400 Bad Request"):
        request = ChatCompletionRequest(
            messages=[ChatMessage(role="user", content="Test prompt")],
            model="invalid-model",
        )
        service.generate_text(request)

    mock_request.side_effect = requests.exceptions.ConnectionError(
        "Failed to establish a connection"
    )
    with pytest.raises(
        requests.exceptions.ConnectionError, match="Failed to establish a connection"
    ):
        request = ChatCompletionRequest(
            messages=[ChatMessage(role="user", content="Test prompt")],
            model="meta-llama/Meta-Llama-3-70B-Instruct",
        )
        service.generate_text(request)


def test_ai_image_generation_invalid_model(mock_api_key):
    """Test image generation with invalid model."""
    service = AIService(mock_api_key)

    request = ImageGenerationRequest(
        prompt="Test prompt",
        model_name="InvalidModel",
        height=1024,
        width=1024,
    )

    with pytest.raises(ValueError, match="Model InvalidModel not supported"):
        service.generate_image(request)
