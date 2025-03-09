"""Hyperbolic AI action provider.

This module provides actions for interacting with Hyperbolic AI services.
It includes functionality for text, image and audio generation.
"""

from typing import Any

from coinbase_agentkit.network import Network

from ...action_decorator import create_action
from ...action_provider import ActionProvider
from ..utils import get_api_key
from .models import (
    AudioGenerationRequest,
    ChatCompletionRequest,
    ChatMessage,
    ImageGenerationRequest,
)
from .schemas import (
    GenerateAudioSchema,
    GenerateImageSchema,
    GenerateTextSchema,
)
from .service import AIService


class AIActionProvider(ActionProvider):
    """Provides actions for interacting with Hyperbolic AI services.

    This provider enables interaction with the Hyperbolic AI services for text, image
    and audio generation. It requires an API key which can be provided directly or
    through the HYPERBOLIC_API_KEY environment variable.
    """

    def __init__(
        self,
        api_key: str | None = None,
    ):
        """Initialize the Hyperbolic AI action provider.

        Args:
            api_key: Optional API key for authentication. If not provided,
                    will attempt to read from HYPERBOLIC_API_KEY environment variable.

        Raises:
            ValueError: If API key is not provided and not found in environment.

        """
        super().__init__("hyperbolic_ai", [])

        try:
            self.api_key = api_key or get_api_key()
        except ValueError as e:
            raise ValueError(
                f"{e!s} Please provide it directly "
                "or set the HYPERBOLIC_API_KEY environment variable."
            ) from e

        self.ai_service = AIService(self.api_key)

    @create_action(
        name="generate_text",
        description="""
This tool generates text using specified language model.

Required inputs:
- prompt: Text prompt for generation.
- model: (Optional) Model to use for text generation.
    Default: "meta-llama/Meta-Llama-3-70B-Instruct"

Example response:
    {
        "id": "chat-12345",
        "created": 1677858242,
        "model": "meta-llama/Meta-Llama-3-70B-Instruct",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Generated text response"
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30
        }
    }

A failure response will return an error message like:
    Error generating text: Invalid model specified
    Error generating text: API request failed

Notes:
- The prompt should be clear and specific
- Response length depends on the prompt and model
""",
        schema=GenerateTextSchema,
    )
    def generate_text(self, args: dict[str, Any]) -> str:
        """Generate text using specified language model.

        Args:
            args (dict[str, Any]): Arguments for text generation.

        Returns:
            str: A JSON string containing the generated text or error details.

        """
        try:
            # Validate arguments using schema
            validated_args = GenerateTextSchema(**args)

            # Create chat message
            messages = []
            if validated_args.system_prompt:
                messages.append(ChatMessage(role="system", content=validated_args.system_prompt))
            messages.append(ChatMessage(role="user", content=validated_args.prompt))

            # Create request
            request = ChatCompletionRequest(
                messages=messages,
                model=validated_args.model,
            )

            # Generate text
            response = self.ai_service.generate_text(request)

            # Return response as JSON string
            return response.model_dump_json(indent=2)
        except Exception as e:
            return f"Error generating text: {e}"

    @create_action(
        name="generate_image",
        description="""
This tool generates images using specified model.

Required inputs:
- prompt: The image prompt to generate from
- model_name: (Optional) The model to use (default: "SDXL1.0-base")
- height: (Optional) Image height in pixels (default: 1024)
- width: (Optional) Image width in pixels (default: 1024)
- steps: (Optional) Number of inference steps (default: 30)
- num_images: (Optional) Number of images to generate (default: 1)
- negative_prompt: (Optional) What to avoid in the image

Example response:
    {
        "images": [
            {
                "image": "base64_encoded_image_data",
                "random_seed": 12345
            }
        ],
        "inference_time": 5.67
    }

A failure response will return an error message like:
    Error generating image: Invalid model specified
    Error generating image: API request failed

Notes:
- The prompt should be descriptive and specific
- Image is returned as base64 encoded PNG
""",
        schema=GenerateImageSchema,
    )
    def generate_image(self, args: dict[str, Any]) -> str:
        """Generate images using specified model.

        Args:
            args (dict[str, Any]): Arguments for image generation.

        Returns:
            str: A JSON string containing the generated image or error details.

        """
        try:
            # Validate arguments using schema
            validated_args = GenerateImageSchema(**args)

            # Create request
            request = ImageGenerationRequest(
                prompt=validated_args.prompt,
                model_name=validated_args.model_name,
                height=validated_args.height,
                width=validated_args.width,
                steps=validated_args.steps,
                num_images=validated_args.num_images,
                negative_prompt=validated_args.negative_prompt,
            )

            # Generate image
            response = self.ai_service.generate_image(request)

            # Return response as JSON string
            return response.model_dump_json(indent=2)
        except Exception as e:
            return f"Error generating image: {e}"

    @create_action(
        name="generate_audio",
        description="""
This tool generates audio from text using specified language and speaker.

Required inputs:
- text: The text to convert to speech
- language: (Optional) The language code (default: "EN")
- speaker: (Optional) The speaker voice (default: "EN-US")
- speed: (Optional) Speaking speed multiplier (0.1-5.0)

Example response:
    {
        "audio": "base64_encoded_audio_data",
        "duration": 5.67
    }

A failure response will return an error message like:
    Error generating audio: Invalid language specified
    Error generating audio: API request failed

Notes:
- Authorization key is required
- The text should be in the specified language
- Audio is returned as base64 encoded MP3
""",
        schema=GenerateAudioSchema,
    )
    def generate_audio(self, args: dict[str, Any]) -> str:
        """Generate audio from text using specified language and speaker.

        Args:
            args (dict[str, Any]): Arguments for audio generation.

        Returns:
            str: A JSON string containing the generated audio or error details.

        """
        try:
            # Handle string input by converting to a dictionary
            if isinstance(args, str):
                args = {"text": args}

            validated_args = GenerateAudioSchema(**args)

            # Create request
            request = AudioGenerationRequest(
                text=validated_args.text,
                language=validated_args.language,
                speaker=validated_args.speaker,
                speed=validated_args.speed,
            )

            # Generate audio
            response = self.ai_service.generate_audio(request)

            # Format the response
            return response.model_dump_json(indent=2)

        except Exception as e:
            return f"Error generating audio: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Hyperbolic AI actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: Always True as Hyperbolic AI actions don't depend on blockchain networks.

        """
        return True


def hyperbolic_ai_action_provider(
    api_key: str | None = None,
) -> AIActionProvider:
    """Create and return a new HyperbolicAIActionProvider instance.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        HyperbolicAIActionProvider: A new instance of the Hyperbolic AI action provider.

    Raises:
        ValueError: If API key is not provided and not found in environment.

    """
    return AIActionProvider(api_key=api_key)
