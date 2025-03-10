"""Tests for generate_image action in HyperbolicAIActionProvider."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.models import (
    GeneratedImage,
    ImageGenerationResponse,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.schemas import (
    GenerateImageSchema,
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
    # Setup mock response
    mock_ai_service.generate_image.return_value = mock_response

    # Mock the save_base64_data function
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        # Setup mock return value
        mock_file_path = "/tmp/generated_image_test.png"
        mock_save.return_value = mock_file_path

        # Call the method with a dictionary
        args = {"prompt": "Test image prompt"}
        result = provider.generate_image(args)

        # Verify the result is a string
        assert isinstance(result, str)

        # Check that the output contains the file path
        assert "Image(s) generated successfully" in result
        assert mock_file_path in result

        # Verify the mock was called correctly
        mock_ai_service.generate_image.assert_called_once()
        request = mock_ai_service.generate_image.call_args[0][0]
        assert request.prompt == "Test image prompt"
        assert request.model_name == "SDXL1.0-base"  # Default value
        assert request.height == 1024  # Default value
        assert request.width == 1024  # Default value


def test_generate_image_with_custom_parameters(provider, mock_ai_service, mock_response):
    """Test image generation with custom parameters."""
    # Setup mock response
    mock_ai_service.generate_image.return_value = mock_response

    # Mock the save_base64_data function
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        # Setup mock return value
        mock_file_path = "/tmp/generated_image_test.png"
        mock_save.return_value = mock_file_path

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

        # Check that the output contains the file path
        assert "Image(s) generated successfully" in result
        assert mock_file_path in result

        # Verify the mock was called correctly
        request = mock_ai_service.generate_image.call_args[0][0]
        assert request.prompt == "Test image prompt"
        assert request.model_name == "SD1.5"
        assert request.height == 512
        assert request.width == 512
        assert request.steps == 50
        assert request.negative_prompt == "blurry, low quality"


def test_generate_image_multiple_images(provider, mock_ai_service):
    """Test generation of multiple images."""
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

    # Mock the save_base64_data function
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        # Setup mock return values for each image
        mock_file_paths = ["/tmp/generated_image_test_1.png", "/tmp/generated_image_test_2.png"]
        mock_save.side_effect = mock_file_paths

        # Call the method with num_images=2
        args = {
            "prompt": "Test image prompt",
            "num_images": 2,
        }
        result = provider.generate_image(args)

        # Verify the result is a string
        assert isinstance(result, str)

        # Check that the output contains both file paths
        assert "Image(s) generated successfully" in result
        assert mock_file_paths[0] in result
        assert mock_file_paths[1] in result

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

    # Test with missing required field
    with pytest.raises(ValidationError):
        GenerateImageSchema()

    # Test with empty prompt
    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="")

    # Test with invalid values
    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", height=4000)  # height > 2048

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", width=32)  # width < 64

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", steps=150)  # steps > 100

    with pytest.raises(ValidationError):
        GenerateImageSchema(prompt="Test", num_images=10)  # num_images > 4


def test_generate_image_error(provider, mock_ai_service):
    """Test image generation with error."""
    # Setup mock to raise exception
    mock_ai_service.generate_image.side_effect = Exception("API error")

    # Call the method
    args = {"prompt": "Test image prompt"}
    result = provider.generate_image(args)

    # Verify the result is a string
    assert isinstance(result, str)
    assert "Error generating image: API error" in result


def test_generate_image_saves_to_file(provider, mock_ai_service, mock_response, tmpdir):
    """Test that image generation saves the output to a file."""
    # Setup mock response
    mock_ai_service.generate_image.return_value = mock_response

    # Mock the save_base64_data function
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        # Setup mock return value with tmpdir path
        mock_file_path = os.path.join(tmpdir, "generated_image_test.png")
        mock_save.return_value = mock_file_path

        # Call the method
        args = {"prompt": "Test image prompt"}
        result = provider.generate_image(args)

        # Verify the result is a string
        assert isinstance(result, str)

        # Check that the output contains the file path
        assert "Image(s) generated successfully" in result
        assert mock_file_path in result

        # Verify save_base64_data was called with the correct arguments
        mock_save.assert_called_once()
        image_data, file_path_arg = mock_save.call_args[0]
        assert image_data == "base64_encoded_image_data"
        assert file_path_arg.startswith("./tmp/generated_image_")
        assert file_path_arg.endswith(".png")
