"""Schemas for Hyperbolic AI actions.

This module provides simplified schemas for AI action inputs.
"""

from pydantic import BaseModel, Field


class GenerateTextSchema(BaseModel):
    """Schema for generate_text action."""

    prompt: str = Field(description="The text prompt to generate from", min_length=1)
    model: str = Field(
        default="meta-llama/Meta-Llama-3-70B-Instruct",
        description="The model to use for text generation",
    )
    system_prompt: str | None = Field(
        default=None,
        description="Optional system prompt to guide the model's behavior",
    )


class GenerateImageSchema(BaseModel):
    """Schema for generate_image action."""

    prompt: str = Field(description="The image prompt to generate from", min_length=1)
    model_name: str = Field(
        default="SDXL1.0-base",
        description="The model to use for image generation",
    )
    height: int = Field(
        default=1024,
        description="Image height in pixels",
        ge=64,
        le=2048,
    )
    width: int = Field(
        default=1024,
        description="Image width in pixels",
        ge=64,
        le=2048,
    )
    steps: int = Field(
        default=30,
        description="Number of inference steps",
        ge=1,
        le=100,
    )
    num_images: int = Field(
        default=1,
        description="Number of images to generate",
        ge=1,
        le=4,
    )
    negative_prompt: str | None = Field(
        None,
        description="Text specifying what the model should not generate",
    )


class GenerateAudioSchema(BaseModel):
    """Schema for generate_audio action."""

    text: str = Field(description="The text to convert to speech", min_length=1)
    language: str = Field(
        default="EN",
        description="The language code (e.g., 'EN', 'ES', 'FR', 'ZH', 'JP', 'KR')",
    )
    speaker: str = Field(
        default="EN-US",
        description="The speaker voice (e.g., 'EN-US', 'EN-GB', 'ES-ES')",
    )
    speed: float | None = Field(
        None,
        description="Speaking speed multiplier",
        ge=0.1,
        le=5.0,
    )
