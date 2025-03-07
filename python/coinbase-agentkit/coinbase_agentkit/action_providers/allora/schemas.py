"""Schemas for Allora action provider."""

from pydantic import BaseModel, Field


class GetAllTopicsInput(BaseModel):
    """Input schema for getting all topics from Allora Network."""

    pass


class GetInferenceByTopicIdInput(BaseModel):
    """Input schema for getting inference data by topic ID."""

    topic_id: int = Field(
        ...,
        description="The ID of the topic to get inference data for",
        gt=0,  # Must be greater than 0
    )


class GetPriceInferenceInput(BaseModel):
    """Input schema for getting price inference for a token/timeframe pair."""

    asset: str = Field(
        ...,
        description="The token to get price inference for (e.g., BTC, ETH). Common values include BTC and ETH, but others may be supported.",
        min_length=1,
    )
    timeframe: str = Field(
        ...,
        description="The timeframe for the prediction (e.g., '5m', '8h'). Common values include 5m and 8h, but others may be supported.",
        min_length=1,
    )
