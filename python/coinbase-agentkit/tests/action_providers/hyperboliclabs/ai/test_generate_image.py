"""Tests for generate_image action in HyperbolicAIActionProvider."""

from unittest.mock import patch, Mock
import json

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider import (
    HyperbolicAIActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.schemas import (
    GenerateImageSchema,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.models import (
    ImageGenerationResponse,
    GeneratedImage,
)
from coinbase_agentkit.action_providers.hyperboliclabs.constants import SUPPORTED_IMAGE_MODELS


@pytest.fixture
def mock_ai_service():
    """Create a mock AIService."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.AIService") as mock:
        yield mock.return_value


@pytest.fixture
def provider():
    """Create a HyperbolicAIActionProvider with a test API key."""
    return HyperbolicAIActionProvider(api_key="test-api-key")


def test_generate_image_success(provider, mock_ai_service, monkeypatch):
    """Test successful image generation."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock response
    mock_response = ImageGenerationResponse(
        images=[
            GeneratedImage(
                image="base64_encoded_image_data",
                random_seed=12345,
                index=0,
            )
        ],
        inference_time=5.67,
    )
    mock_ai_service.generate_image.return_value = mock_response

    # Call the method with a dictionary
    args = {"prompt": "Test image prompt"}
    result = provider.generate_image(args)

    # Verify the result is a string
    assert isinstance(result, str)
    
    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert len(result_json["images"]) == 1
    assert result_json["images"][0]["image"] == "base64_encoded_image_data"
    assert result_json["images"][0]["random_seed"] == 12345
    assert result_json["inference_time"] == 5.67

    # Verify the mock was called correctly
    mock_ai_service.generate_image.assert_called_once()
    request = mock_ai_service.generate_image.call_args[0][0]
    assert request.prompt == "Test image prompt"
    assert request.model_name == "SDXL1.0-base"  # Default value
    assert request.height == 1024  # Default value
    assert request.width == 1024  # Default value


def test_generate_image_with_custom_parameters(provider, mock_ai_service, monkeypatch):
    """Test image generation with custom parameters."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock response
    mock_response = ImageGenerationResponse(
        images=[
            GeneratedImage(
                image="base64_encoded_image_data",
                random_seed=12345,
                index=0,
            )
        ],
        inference_time=5.67,
    )
    mock_ai_service.generate_image.return_value = mock_response

    # Call the method with custom parameters
    args = {
        "prompt": "Test image prompt",
        "model_name": "SD1.5",
        "height": 512,
        "width": 512,
        "steps": 50,
        "negative_prompt": "blurry, low quality",
    }
    result = provider.generate_image(args)

    # Verify the result is a string
    assert isinstance(result, str)
    
    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert len(result_json["images"]) == 1

    # Verify the mock was called correctly
    request = mock_ai_service.generate_image.call_args[0][0]
    assert request.prompt == "Test image prompt"
    assert request.model_name == "SD1.5"
    assert request.height == 512
    assert request.width == 512
    assert request.steps == 50
    assert request.negative_prompt == "blurry, low quality"


def test_generate_image_multiple_images(provider, mock_ai_service, monkeypatch):
    """Test generation of multiple images."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock response with multiple images
    mock_response = ImageGenerationResponse(
        images=[
            GeneratedImage(
                image="base64_encoded_image_data_1",
                random_seed=12345,
                index=0,
            ),
            GeneratedImage(
                image="base64_encoded_image_data_2",
                random_seed=67890,
                index=1,
            ),
        ],
        inference_time=10.5,
    )
    mock_ai_service.generate_image.return_value = mock_response

    # Call the method with num_images=2
    args = {
        "prompt": "Test image prompt",
        "num_images": 2,
    }
    result = provider.generate_image(args)

    # Verify the result is a string
    assert isinstance(result, str)
    
    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert len(result_json["images"]) == 2
    assert result_json["images"][0]["image"] == "base64_encoded_image_data_1"
    assert result_json["images"][1]["image"] == "base64_encoded_image_data_2"

    # Verify the mock was called correctly
    request = mock_ai_service.generate_image.call_args[0][0]
    assert request.prompt == "Test image prompt"
    assert request.num_images == 2


def test_generate_image_schema_validation():
    """Test schema validation for generate_image."""
    # Test with valid data
    valid_data = {"prompt": "Test image prompt"}
    schema = GenerateImageSchema(**valid_data)
    assert schema.prompt == "Test image prompt"
    assert schema.model_name == "SDXL1.0-base"  # Default value
    assert schema.height == 1024  # Default value
    assert schema.width == 1024  # Default value
    assert schema.steps == 30  # Default value
    assert schema.num_images == 1  # Default value
    assert schema.negative_prompt is None  # Default value

    # Test with custom parameters
    custom_data = {
        "prompt": "Test image prompt",
        "model_name": "SD1.5",
        "height": 512,
        "width": 512,
        "steps": 50,
        "num_images": 2,
        "negative_prompt": "blurry, low quality",
    }
    schema = GenerateImageSchema(**custom_data)
    assert schema.prompt == "Test image prompt"
    assert schema.model_name == "SD1.5"
    assert schema.height == 512
    assert schema.width == 512
    assert schema.steps == 50
    assert schema.num_images == 2
    assert schema.negative_prompt == "blurry, low quality"

    # Test with missing required field
    with pytest.raises(ValidationError):
        GenerateImageSchema()

    # Test with invalid values
    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", height=4000)  # height > 2048
    
    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", width=32)  # width < 64
    
    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", steps=150)  # steps > 100
    
    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", num_images=10)  # num_images > 4


def test_generate_image_error(provider, mock_ai_service, monkeypatch):
    """Test image generation with error."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock to raise exception
    mock_ai_service.generate_image.side_effect = Exception("API error")

    # Call the method
    args = {"prompt": "Test image prompt"}
    result = provider.generate_image(args)

    # Verify the result is a string
    assert isinstance(result, str)
    assert "Error generating image: API error" in result


def test_generate_image_invalid_model(provider, mock_ai_service, monkeypatch):
    """Test image generation with invalid model."""
    # Replace the provider's ai_service with our mock
    monkeypatch.setattr(provider, "ai_service", mock_ai_service)
    
    # Setup mock to raise ValueError for invalid model
    mock_ai_service.generate_image.side_effect = ValueError(
        f"Model InvalidModel not supported. Use one of: {SUPPORTED_IMAGE_MODELS}"
    )

    # Call the method with invalid model
    args = {
        "prompt": "Test image prompt",
        "model_name": "InvalidModel"
    }
    result = provider.generate_image(args)

    # Verify the result is a string
    assert isinstance(result, str)
    assert "Error generating image: Model InvalidModel not supported" in result 