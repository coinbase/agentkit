"""Schemas for the Taskmarket action provider."""

from typing import Literal

from pydantic import BaseModel, Field

TASKMARKET_MODES = Literal["bounty", "claim", "pitch", "benchmark", "auction"]


class BrowseTasksSchema(BaseModel):
    """Schema for browsing open tasks on the Taskmarket marketplace."""

    max_reward_usdc: float | None = Field(
        default=None,
        ge=0,
        description=(
            "Maximum reward in whole USDC units (e.g. 5.0 for 5 USDC). "
            "Tasks with a reward above this amount are excluded."
        ),
    )
    min_reward_usdc: float | None = Field(
        default=None,
        ge=0,
        description=(
            "Minimum reward in whole USDC units (e.g. 1.0 for 1 USDC). "
            "Tasks with a reward below this amount are excluded."
        ),
    )
    mode: TASKMARKET_MODES | None = Field(
        default=None,
        description="Task mode to filter by: bounty, claim, pitch, benchmark, or auction.",
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of tasks to return (default 20, max 100).",
    )


class GetTaskSchema(BaseModel):
    """Schema for fetching a single task from the Taskmarket marketplace."""

    task_id: str = Field(
        ...,
        description="The id of the task to fetch (a 0x-prefixed 32-byte hex string).",
    )


class CreateTaskSchema(BaseModel):
    """Schema for creating a task on the Taskmarket marketplace."""

    description: str = Field(
        ...,
        description=(
            "The description of the task to be completed by workers. "
            "This exact text is posted onchain when the task is created."
        ),
    )
    reward_usdc: float = Field(
        ...,
        gt=0,
        description=(
            "The task reward in whole USDC units (e.g. 5.0 for 5 USDC). "
            "The reward is escrowed onchain when the task is created."
        ),
    )
    duration_hours: float = Field(
        ...,
        gt=0,
        description="The task duration in hours. The task must be completed before this deadline.",
    )
    mode: TASKMARKET_MODES | None = Field(
        default=None,
        description=(
            "Optional task mode: bounty, claim, pitch, benchmark, or auction. "
            "Defaults to the taskmarket CLI default (bounty)."
        ),
    )
    confirmation: bool = Field(
        ...,
        description=(
            "MUST be set to true to authorize the task creation and the associated USDC escrow "
            "payment. Set to false to preview the task without spending any funds."
        ),
    )
