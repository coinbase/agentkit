"""Tests for generate_audio action in HyperbolicAIActionProvider."""

import json

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider import (
    GenerateAudioSchema,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.models import (
    AudioGenerationResponse,
)


def test_generate_audio_success(provider, mock_ai_service):
    """Test successful audio generation."""
    # Setup mock response
    mock_response = AudioGenerationResponse(
        audio="base64_encoded_audio_data",
        duration=3.5,
    )
    mock_ai_service.generate_audio.return_value = mock_response

    # Call the method with a dictionary
    args = {"text": "Test audio text"}
    result = provider.generate_audio(args)

    # Verify the result is a string
    assert isinstance(result, str)

    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert result_json["audio"] == "base64_encoded_audio_data"
    assert result_json["duration"] == 3.5

    # Verify the mock was called correctly
    mock_ai_service.generate_audio.assert_called_once()
    request = mock_ai_service.generate_audio.call_args[0][0]
    assert request.text == "Test audio text"
    assert request.language == "EN"  # Default value
    assert request.speaker == "EN-US"  # Default value


def test_generate_audio_with_minimal_input(provider, mock_ai_service):
    """Test audio generation with a dictionary containing only the required text field."""
    # Setup mock response
    mock_response = AudioGenerationResponse(
        audio="base64_encoded_audio_data",
        duration=3.5,
    )
    mock_ai_service.generate_audio.return_value = mock_response

    # Call the method with a dictionary containing only the required text
    result = provider.generate_audio({"text": "Test audio text"})

    # Verify the result is a string
    assert isinstance(result, str)

    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert result_json["audio"] == "base64_encoded_audio_data"
    assert result_json["duration"] == 3.5

    # Verify the mock was called correctly
    request = mock_ai_service.generate_audio.call_args[0][0]
    assert request.text == "Test audio text"
    assert request.language == "EN"  # Default value
    assert request.speaker == "EN-US"  # Default value


def test_generate_audio_with_custom_parameters(provider, mock_ai_service):
    """Test audio generation with custom parameters."""
    # Setup mock response
    mock_response = AudioGenerationResponse(
        audio="base64_encoded_audio_data",
        duration=3.5,
    )
    mock_ai_service.generate_audio.return_value = mock_response

    # Call the method with custom parameters
    args = {
        "text": "Test audio text",
        "language": "ES",
        "speaker": "ES-ES",
        "speed": 1.2,
    }
    result = provider.generate_audio(args)

    # Verify the result is a string
    assert isinstance(result, str)

    # Parse the JSON string to verify its contents
    result_json = json.loads(result)
    assert result_json["audio"] == "base64_encoded_audio_data"
    assert result_json["duration"] == 3.5

    # Verify the mock was called correctly
    request = mock_ai_service.generate_audio.call_args[0][0]
    assert request.text == "Test audio text"
    assert request.language == "ES"
    assert request.speaker == "ES-ES"
    assert request.speed == 1.2


def test_generate_audio_schema_validation():
    """Test schema validation for generate_audio."""
    # Test with valid data
    valid_data = {"text": "Test audio text"}
    schema = GenerateAudioSchema(**valid_data)
    assert schema.text == "Test audio text"
    assert schema.language == "EN"  # Default value
    assert schema.speaker == "EN-US"  # Default value
    assert schema.speed is None  # Default value

    # Test with custom parameters
    custom_data = {
        "text": "Test audio text",
        "language": "ES",
        "speaker": "ES-ES",
        "speed": 1.2,
    }
    schema = GenerateAudioSchema(**custom_data)
    assert schema.text == "Test audio text"
    assert schema.language == "ES"
    assert schema.speaker == "ES-ES"
    assert schema.speed == 1.2

    # Test with missing required field
    with pytest.raises(ValidationError):
        GenerateAudioSchema()

    # Test with invalid values
    with pytest.raises(ValidationError):
        GenerateAudioSchema(text="Test", speed=0.05)  # speed < 0.1

    with pytest.raises(ValidationError):
        GenerateAudioSchema(text="Test", speed=6.0)  # speed > 5.0


def test_generate_audio_error(provider, mock_ai_service):
    """Test audio generation with error."""
    # Setup mock to raise exception
    mock_ai_service.generate_audio.side_effect = Exception("API error")

    # Call the method
    args = {"text": "Test audio text"}
    result = provider.generate_audio(args)

    # Verify the result is a string
    assert isinstance(result, str)
    assert "Error generating audio: API error" in result
