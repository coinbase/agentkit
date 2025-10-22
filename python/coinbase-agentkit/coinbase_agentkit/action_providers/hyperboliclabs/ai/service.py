"""Service for AI-related operations."""

from ..constants import AI_SERVICES_BASE_URL, AI_SERVICES_ENDPOINTS, SUPPORTED_IMAGE_MODELS
from ..service import Base
from .types import (
    AudioGenerationRequest,
    AudioGenerationResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
)


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

        """
        response = self.make_request(
            endpoint=AI_SERVICES_ENDPOINTS["TEXT_GENERATION"],
            data=request.model_dump(exclude_none=True),
        )

        return ChatCompletionResponse(**response.json())

    def generate_image(
        self,
        request: ImageGenerationRequest,
    ) -> ImageGenerationResponse:
        """Generate images using specified model.

        Args:
            request: The ImageGenerationRequest object containing the request parameters.

        Returns:
            ImageGenerationResponse: The image generation response.

        """
        if request.model_name not in SUPPORTED_IMAGE_MODELS:
            raise ValueError(
                f"Model {request.model_name} not supported. Use one of: {SUPPORTED_IMAGE_MODELS}"
            )

        response = self.make_request(
            endpoint=AI_SERVICES_ENDPOINTS["IMAGE_GENERATION"],
            data=request.model_dump(exclude_none=True),
        )

        return ImageGenerationResponse(**response.json())

    def generate_audio(
        self,
        request: AudioGenerationRequest,
    ) -> AudioGenerationResponse:
        """Generate audio using specified model.

        Args:
            request: The AudioGenerationRequest object containing the request parameters.

        Returns:
            AudioGenerationResponse: The audio generation response.

        """
        response = self.make_request(
            endpoint=AI_SERVICES_ENDPOINTS["AUDIO_GENERATION"],
            data=request.model_dump(exclude_none=True),
        )

        return AudioGenerationResponse(**response.json())
