"""AI service for Hyperbolic platform."""

from ..constants import AI_SERVICES_BASE_URL, AI_SERVICES_ENDPOINTS, SUPPORTED_IMAGE_MODELS
from .models import (
    AudioGenerationRequest,
    AudioGenerationResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
)
from ..services.base import Base


class AIService(Base):
    """AI service for Hyperbolic platform."""

    def __init__(self, api_key: str):
        """Initialize AI service.

        Args:
            api_key: API key for authentication.
        """
        super().__init__(api_key, AI_SERVICES_BASE_URL)

    def generate_text(
        self,
        request: ChatCompletionRequest,
    ) -> ChatCompletionResponse:
        """Generate text using specified model.

        Args:
            request: The ChatCompletionRequest object containing the request parameters.

        Returns:
            ChatCompletionResponse: The chat completion response.

        Raises:
            requests.exceptions.RequestException: If the API request fails.
            pydantic.ValidationError: If the request or response validation fails.
        """
        response_data = self.make_request(
            endpoint=AI_SERVICES_ENDPOINTS["TEXT_GENERATION"],
            data=request.model_dump(exclude_none=True),
        )

        return ChatCompletionResponse(**response_data)

    def generate_image(
        self,
        request: ImageGenerationRequest,
    ) -> ImageGenerationResponse:
        """Generate images using specified model.

        Args:
            request: The ImageGenerationRequest object containing the request parameters.

        Returns:
            ImageGenerationResponse: The image generation response.

        Raises:
            requests.exceptions.RequestException: If the API request fails.
            ValueError: If the model is not supported.
            pydantic.ValidationError: If the request or response validation fails.
        """
        # Validate model
        if request.model_name not in SUPPORTED_IMAGE_MODELS:
            raise ValueError(
                f"Model {request.model_name} not supported. Use one of: {SUPPORTED_IMAGE_MODELS}"
            )

        response_data = self.make_request(
            endpoint=AI_SERVICES_ENDPOINTS["IMAGE_GENERATION"],
            data=request.model_dump(exclude_none=True),
        )

        return ImageGenerationResponse(**response_data)

    def generate_audio(
        self,
        request: AudioGenerationRequest,
    ) -> AudioGenerationResponse:
        """Generate audio from text using specified language and speaker.

        Args:
            request: The AudioGenerationRequest object containing the request parameters.

        Returns:
            AudioGenerationResponse: The audio generation response containing base64 encoded MP3.

        Raises:
            requests.exceptions.RequestException: If the API request fails.
            ValueError: If language not supported or speaker not valid for language.
            pydantic.ValidationError: If the request or response validation fails.
        """
        response_data = self.make_request(
            endpoint=AI_SERVICES_ENDPOINTS["AUDIO_GENERATION"],
            data=request.model_dump(exclude_none=True),
        )

        return AudioGenerationResponse(**response_data) 