"""Schemas for Taskmarket action provider."""

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator


class CreateTaskmarketTaskSchema(BaseModel):
    """Input schema for creating a Taskmarket task."""

    description: str = Field(
        ...,
        description="The full task description including deliverables and acceptance criteria",
    )
    reward: str = Field(
        ...,
        description="Reward amount in USDC whole units (e.g. '5' for 5 USDC)",
    )
    duration_hours: int = Field(
        ...,
        description="Task duration in hours from creation",
    )
    deliverables: str = Field(
        default="",
        description="Summary of expected deliverables for the requester workflow",
    )
    max_spend: str = Field(
        default="0",
        description="Maximum total spend cap in USDC whole units (e.g. '10' for 10 USDC)",
    )
    tags: str = Field(
        default="",
        description="Comma-separated tags for the task",
    )

    @field_validator("reward")
    @classmethod
    def validate_reward(cls, v: str) -> str:
        """Validate reward is a positive decimal."""
        try:
            d = Decimal(v)
            if d <= 0:
                raise ValueError("Reward must be positive")
        except Exception as e:
            raise ValueError(f"Reward must be a positive number: {e}")
        return v

    @field_validator("duration_hours")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        """Validate duration is positive."""
        if v <= 0:
            raise ValueError("Duration must be positive")
        return v


class GetTaskmarketTaskSchema(BaseModel):
    """Input schema for getting a Taskmarket task."""

    task_id: str = Field(
        ...,
        description="The Taskmarket task ID to retrieve",
    )


class ListTaskmarketSubmissionsSchema(BaseModel):
    """Input schema for listing Taskmarket task submissions."""

    task_id: str = Field(
        ...,
        description="The Taskmarket task ID to list submissions for",
    )
