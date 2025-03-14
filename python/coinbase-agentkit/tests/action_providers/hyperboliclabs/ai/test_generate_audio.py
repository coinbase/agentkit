"""Tests for generate_audio action in HyperbolicAIActionProvider."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperboliclabs.ai.schemas import (
    GenerateAudioSchema,
)
from coinbase_agentkit.action_providers.hyperboliclabs.ai.types import (
    AudioGenerationResponse,
)


@pytest.fixture
def mock_response():
    """Create a standard mock audio response."""
    return AudioGenerationResponse(
        audio="base64_encoded_audio_data",
        duration=3.5,
    )


def test_generate_audio_success(provider, mock_ai_service, mock_response):
    """Test successful audio generation."""
    mock_ai_service.generate_audio.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_path = "/tmp/generated_audio_test.mp3"
        mock_save.return_value = mock_file_path

        args = {"text": "Test audio text"}
        result = provider.generate_audio(args)

        assert isinstance(result, str)

        assert "Audio generation successful:" in result
        assert mock_file_path in result

        mock_ai_service.generate_audio.assert_called_once()
        request = mock_ai_service.generate_audio.call_args[0][0]
        assert request.text == "Test audio text"
        assert request.language == "EN"
        assert request.speaker == "EN-US"


def test_generate_audio_with_minimal_input(provider, mock_ai_service, mock_response):
    """Test audio generation with a dictionary containing only the required text field."""
    mock_ai_service.generate_audio.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_path = "/tmp/generated_audio_test.mp3"
        mock_save.return_value = mock_file_path

        result = provider.generate_audio({"text": "Test audio text"})

        assert isinstance(result, str)

        assert "Audio generation successful:" in result
        assert mock_file_path in result

        request = mock_ai_service.generate_audio.call_args[0][0]
        assert request.text == "Test audio text"
        assert request.language == "EN"
        assert request.speaker == "EN-US"


def test_generate_audio_with_custom_parameters(provider, mock_ai_service, mock_response):
    """Test audio generation with custom parameters."""
    mock_ai_service.generate_audio.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_path = "/tmp/generated_audio_test.mp3"
        mock_save.return_value = mock_file_path

        args = {
            "text": "Test audio text",
            "language": "ES",
            "speaker": "ES-ES",
            "speed": 1.2,
        }
        result = provider.generate_audio(args)

        assert isinstance(result, str)

        assert "Audio generation successful:" in result
        assert mock_file_path in result

        request = mock_ai_service.generate_audio.call_args[0][0]
        assert request.text == "Test audio text"
        assert request.language == "ES"
        assert request.speaker == "ES-ES"
        assert request.speed == 1.2


def test_generate_audio_schema_validation():
    """Test schema validation for generate_audio."""
    valid_data = {"text": "Test audio text"}
    schema = GenerateAudioSchema(**valid_data)
    assert schema.text == "Test audio text"
    assert schema.language == "EN"
    assert schema.speaker == "EN-US"
    assert schema.speed is None

    with pytest.raises(ValidationError):
        GenerateAudioSchema()

    with pytest.raises(ValidationError):
        GenerateAudioSchema(text="")

    with pytest.raises(ValidationError):
        GenerateAudioSchema(text="Test", speed=0.05)

    with pytest.raises(ValidationError):
        GenerateAudioSchema(text="Test", speed=6.0)


def test_generate_audio_error(provider, mock_ai_service):
    """Test audio generation with error."""
    mock_ai_service.generate_audio.side_effect = Exception("API error")

    args = {"text": "Test audio text"}
    result = provider.generate_audio(args)

    assert isinstance(result, str)
    assert "Error: Audio generation: API error" in result


def test_generate_audio_saves_to_file(provider, mock_ai_service, mock_response, tmpdir):
    """Test that audio generation saves the output to a file."""
    mock_ai_service.generate_audio.return_value = mock_response

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.ai.action_provider.save_base64_data"
    ) as mock_save:
        mock_file_path = os.path.join(tmpdir, "generated_audio_test.mp3")
        mock_save.return_value = mock_file_path

        args = {"text": "Test audio text"}
        result = provider.generate_audio(args)

        assert isinstance(result, str)

        assert "Audio generation successful:" in result
        assert mock_file_path in result

        mock_save.assert_called_once()
        audio_data, file_path_arg = mock_save.call_args[0]
        assert audio_data == "base64_encoded_audio_data"
        assert file_path_arg.startswith("./tmp/generated_audio_")
        assert file_path_arg.endswith(".mp3")
