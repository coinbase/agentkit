"""Tests for generate_image action in HyperbolicAIActionProvider."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.schemas import (
    GenerateImageSchema,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.types import (
    GeneratedImage,
    ImageGenerationResponse,
)


@pytest.fixture
def mock_response():
    """Create a standard mock image response."""
    return ImageGenerationResponse(
        images=[
            GeneratedImage(
                image="base64_encoded_image_data",
                random_seed=12345,
                index=0,
            )
        ],
        inference_time=5.67,
    )


def test_generate_image_success(provider, mock_ai_service, mock_response):
    """Test successful image generation."""
    mock_ai_service.generate_image.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_path = "/tmp/generated_image_test.png"
        mock_save.return_value = mock_file_path

        args = {"prompt": "Test image prompt"}
        result = provider.generate_image(args)

        assert isinstance(result, str)

        assert "Image generation successful:" in result
        assert mock_file_path in result

        mock_ai_service.generate_image.assert_called_once()
        request = mock_ai_service.generate_image.call_args[0][0]
        assert request.prompt == "Test image prompt"
        assert request.model_name == "SDXL1.0-base"
        assert request.height == 1024
        assert request.width == 1024


def test_generate_image_with_custom_parameters(provider, mock_ai_service, mock_response):
    """Test image generation with custom parameters."""
    mock_ai_service.generate_image.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_path = "/tmp/generated_image_test.png"
        mock_save.return_value = mock_file_path

        args = {
            "prompt": "Test image prompt",
            "model_name": "SD1.5",
            "height": 512,
            "width": 512,
            "steps": 50,
            "negative_prompt": "blurry, low quality",
        }
        result = provider.generate_image(args)

        assert isinstance(result, str)

        assert "Image generation successful:" in result
        assert mock_file_path in result

        request = mock_ai_service.generate_image.call_args[0][0]
        assert request.prompt == "Test image prompt"
        assert request.model_name == "SD1.5"
        assert request.height == 512
        assert request.width == 512
        assert request.steps == 50
        assert request.negative_prompt == "blurry, low quality"


def test_generate_image_multiple_images(provider, mock_ai_service):
    """Test generation of multiple images."""
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

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_paths = ["/tmp/generated_image_test_1.png", "/tmp/generated_image_test_2.png"]
        mock_save.side_effect = mock_file_paths

        args = {
            "prompt": "Test image prompt",
            "num_images": 2,
        }
        result = provider.generate_image(args)

        assert isinstance(result, str)

        assert "Image generation successful:" in result
        assert mock_file_paths[0] in result
        assert mock_file_paths[1] in result

        request = mock_ai_service.generate_image.call_args[0][0]
        assert request.prompt == "Test image prompt"
        assert request.num_images == 2


def test_generate_image_schema_validation():
    """Test schema validation for generate_image."""
    valid_data = {"prompt": "Test image prompt"}
    schema = GenerateImageSchema(**valid_data)
    assert schema.prompt == "Test image prompt"
    assert schema.model_name == "SDXL1.0-base"
    assert schema.height == 1024
    assert schema.width == 1024
    assert schema.steps == 30
    assert schema.num_images == 1
    assert schema.negative_prompt is None

    with pytest.raises(ValidationError):
        GenerateImageSchema()

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="")

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", height=4000)

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", width=32)

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", steps=150)

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", num_images=10)


def test_generate_image_error(provider, mock_ai_service):
    """Test image generation with error."""
    mock_ai_service.generate_image.side_effect = Exception("API error")

    args = {"prompt": "Test image prompt"}
    result = provider.generate_image(args)

    assert isinstance(result, str)
    assert "Error: Image generation: API error" in result


def test_generate_image_saves_to_file(provider, mock_ai_service, mock_response, tmpdir):
    """Test that image generation saves the output to a file."""
    mock_ai_service.generate_image.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_path = os.path.join(tmpdir, "generated_image_test.png")
        mock_save.return_value = mock_file_path

        args = {"prompt": "Test image prompt"}
        result = provider.generate_image(args)

        assert isinstance(result, str)

        assert "Image generation successful:" in result
        assert mock_file_path in result

        mock_save.assert_called_once()
        image_data, file_path_arg = mock_save.call_args[0]
        assert image_data == "base64_encoded_image_data"
        assert file_path_arg.startswith("./tmp/generated_image_")
        assert file_path_arg.endswith(".png")
