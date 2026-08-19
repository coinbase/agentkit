"""Input schemas for the Taskmarket read-only action provider."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class ListTasksSchema(BaseModel):
    """Filters for discovering public Taskmarket work."""

    mode: Literal["claim", "pitch", "benchmark", "auction", "bounty"] | None = Field(
        default=None, description="Optional Taskmarket task mode"
    )
    min_reward_usdc: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        decimal_places=6,
        description="Minimum reward in decimal USDC",
    )
    deadline_hours: int | None = Field(
        default=None, gt=0, le=8760, description="Only work due within this many hours"
    )
    limit: int = Field(default=10, ge=1, le=20, description="Maximum tasks to return")


class GetTaskSchema(BaseModel):
    """Identifier for inspecting one public Taskmarket task."""

    task_id: str = Field(
        ...,
        pattern=r"^0x[0-9a-fA-F]{64}$",
        description="Taskmarket task identifier",
    )
