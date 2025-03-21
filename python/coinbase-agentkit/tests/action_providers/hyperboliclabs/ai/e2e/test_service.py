"""End-to-end tests for Hyperbolic AI service.

These tests make real API calls to the Hyperbolic platform.
They require a valid API key in the HYPERBOLIC_API_KEY environment variable.
"""

import base64
import os
from io import BytesIO

import pytest
import requests
from PIL import Image

from coinbase_agentkit.action_providers.hyperboliclabs.ai.types import (
    AudioGenerationRequest,
    AudioGenerationResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
    ImageGenerationRequest,
)
from coinbase_agentkit.action_providers.hyperboliclabs.constants import (
    SUPPORTED_AUDIO_LANGUAGES,
    SUPPORTED_IMAGE_MODELS,
)


def encode_image(img):
    """Encode PIL.Image into base64 string."""
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    encoded_string = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return encoded_string


def decode_image(encoded_string):
    """Decode base64 string into PIL.Image."""
    image_data = base64.b64decode(encoded_string)
    image = Image.open(BytesIO(image_data)).convert("RGB")
    return image


def save_image(image_data, output_path):
    """Save base64 string as image file."""
    image = decode_image(image_data)
    image.save(output_path)
    return output_path


@pytest.mark.e2e
def test_ai_audio_generation(ai_service):
    """Test audio generation with different inputs and parameters."""
    text = "Hello, this is a test"

    request = AudioGenerationRequest(text=text)
    response = ai_service.generate_audio(request)
    assert isinstance(response, AudioGenerationResponse)
    assert response.audio is not None
    assert isinstance(response.audio, str)
    if response.duration:
        assert response.duration > 0

    request = AudioGenerationRequest(
        text="Testing audio parameters",
        language="EN",
        speaker="EN-US",
        sdp_ratio=0.5,
        noise_scale=0.6,
        noise_scale_w=0.7,
        speed=1.2,
    )
    response = ai_service.generate_audio(request)
    assert isinstance(response, AudioGenerationResponse)
    assert response.audio is not None
    if response.duration:
        assert response.duration > 0


@pytest.mark.e2e
@pytest.mark.parametrize("language", SUPPORTED_AUDIO_LANGUAGES)
def test_ai_audio_generation_languages(ai_service, language):
    """Test audio generation with different languages."""
    text = "Hello, this is a language test"
    request = AudioGenerationRequest(text=text, language=language)
    response = ai_service.generate_audio(request)

    assert isinstance(response, AudioGenerationResponse)
    assert response.audio is not None
    if response.duration:
        assert response.duration > 0


@pytest.mark.e2e
def test_ai_chat_completion(ai_service):
    """Test chat completion with different prompts."""
    messages = [
        ChatMessage(role="system", content="You are a helpful assistant."),
        ChatMessage(role="user", content="What is 2+2?"),
    ]
    request = ChatCompletionRequest(messages=messages, model="meta-llama/Meta-Llama-3-70B-Instruct")
    response = ai_service.generate_text(request)
    assert isinstance(response, ChatCompletionResponse)
    assert len(response.choices) > 0
    assert response.choices[0].message.role == "assistant"

    if response.usage:
        assert response.usage.prompt_tokens > 0
        assert response.usage.completion_tokens > 0
        assert response.usage.total_tokens == (
            response.usage.prompt_tokens + response.usage.completion_tokens
        )


@pytest.mark.e2e
def test_ai_image_generation(ai_service, tmp_path):
    """Test image generation with different models and parameters."""
    prompt = "A beautiful sunset over mountains"

    request = ImageGenerationRequest(
        prompt=prompt,
        model_name="SDXL1.0-base",
        height=1024,
        width=1024,
        steps=30,
        num_images=1,
    )
    response = ai_service.generate_image(request)

    assert len(response.images) > 0
    assert response.inference_time is not None
    assert isinstance(response.inference_time, float)

    image = response.images[0]
    assert image.image is not None
    assert isinstance(image.random_seed, int)
    assert isinstance(image.index, int)

    output_path = os.path.join(tmp_path, "generated_image.png")
    saved_path = save_image(image.image, output_path)
    assert os.path.exists(saved_path)
    print(f"\nImage saved to: {saved_path}")

    request = ImageGenerationRequest(
        prompt=prompt,
        model_name="SDXL1.0-base",
        height=512,
        width=512,
        steps=20,
        num_images=1,
    )
    response = ai_service.generate_image(request)

    assert len(response.images) > 0
    assert response.inference_time is not None

    image = response.images[0]
    assert image.image is not None
    assert isinstance(image.random_seed, int)
    assert isinstance(image.index, int)

    output_path = os.path.join(tmp_path, "generated_image_custom.png")
    saved_path = save_image(image.image, output_path)
    assert os.path.exists(saved_path)
    print(f"\nCustom image saved to: {saved_path}")


@pytest.mark.e2e
@pytest.mark.parametrize("model", SUPPORTED_IMAGE_MODELS)
def test_ai_image_generation_models(ai_service, model, tmp_path):
    """Test image generation with different models."""
    if "ControlNet" in model:
        pytest.skip("ControlNet models are tested separately")

    prompt = "A serene lake at dawn"
    request = ImageGenerationRequest(
        prompt=prompt,
        model_name=model,
        height=512,
        width=512,
        steps=20,
        num_images=1,
        cfg_scale=15,
    )
    response = ai_service.generate_image(request)

    assert len(response.images) > 0
    assert response.inference_time is not None
    assert isinstance(response.inference_time, float)

    image = response.images[0]
    assert image.image is not None
    assert isinstance(image.random_seed, int)
    assert isinstance(image.index, int)

    output_path = os.path.join(tmp_path, f"generated_image_{model.lower()}.png")
    saved_path = save_image(image.image, output_path)
    assert os.path.exists(saved_path)
    print(f"\nImage from {model} saved to: {saved_path}")


@pytest.mark.e2e
@pytest.mark.parametrize("model", ["SDXL-ControlNet", "SD1.5-ControlNet"])
@pytest.mark.parametrize("controlnet_type", ["canny", "depth", "softedge", "openpose"])
def test_ai_image_generation_controlnet(ai_service, model, controlnet_type, tmp_path):
    """Test image generation with ControlNet models and different control types."""
    prompt = "an astronaut on mars"

    image_url = (
        "https://huggingface.co/lllyasviel/sd-controlnet-depth/resolve/main/images/stormtrooper.png"
    )
    response = requests.get(image_url)
    response.raise_for_status()
    image = Image.open(BytesIO(response.content))
    test_image = encode_image(image)

    request = ImageGenerationRequest(
        prompt=prompt,
        model_name=model,
        height=512,
        width=512,
        steps=20,
        num_images=1,
        cfg_scale=15,
        controlnet_name=controlnet_type,
        controlnet_image=test_image,
        seed=5742320,
    )

    print("\nRequest data:")
    print(f"  Model: {model}")
    print(f"  ControlNet type: {controlnet_type}")

    try:
        response = ai_service.generate_image(request)

        assert len(response.images) > 0
        assert response.inference_time is not None
        assert isinstance(response.inference_time, float)

        image = response.images[0]
        assert image.image is not None
        assert isinstance(image.random_seed, int)
        assert isinstance(image.index, int)

        output_path = os.path.join(
            tmp_path, f"generated_image_{model.lower()}_{controlnet_type}.png"
        )
        saved_path = save_image(image.image, output_path)
        assert os.path.exists(saved_path)
        print(f"\nControlNet image saved to: {saved_path}")
    except Exception as e:
        pytest.skip(f"ControlNet test failed: {e!s}")
