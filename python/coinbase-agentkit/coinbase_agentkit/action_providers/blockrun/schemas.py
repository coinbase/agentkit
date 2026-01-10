"""Schemas for BlockRun action provider."""

from pydantic import BaseModel, Field


class ChatCompletionSchema(BaseModel):
    """Schema for chat completion request."""

    model: str = Field(
        default="openai/gpt-4o-mini",
        description=(
            "The model to use for chat completion. "
            "Available models: openai/gpt-4o, openai/gpt-4o-mini, "
            "anthropic/claude-sonnet-4, google/gemini-2.0-flash, "
            "deepseek/deepseek-chat"
        ),
    )
    prompt: str = Field(
        ...,
        description="The user message or prompt to send to the model.",
    )
    system_prompt: str | None = Field(
        default=None,
        description="Optional system prompt to set context for the conversation.",
    )
    max_tokens: int = Field(
        default=1024,
        description="Maximum number of tokens to generate in the response.",
    )
    temperature: float = Field(
        default=0.7,
        description="Sampling temperature between 0 and 2. Higher values make output more random.",
    )


class ListModelsSchema(BaseModel):
    """Schema for listing available models."""

    pass
