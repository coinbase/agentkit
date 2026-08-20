"""Schemas for the TaskMarket action provider."""

from pydantic import BaseModel, Field, field_validator


class BrowseTaskMarketTasksSchema(BaseModel):
    """Input schema for browsing public TaskMarket tasks."""

    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of tasks to return")
    tag: str | None = Field(default=None, description="Optional tag keyword to filter tasks")
    max_submissions: int | None = Field(
        default=None,
        ge=0,
        description="Optional maximum submission count to prefer lower-competition tasks",
    )


class TaskMarketTaskDraftSchema(BaseModel):
    """Input schema for preparing a TaskMarket delegation draft."""

    title: str = Field(..., min_length=5, max_length=140)
    deliverable: str = Field(..., min_length=20, max_length=2000)
    acceptance_criteria: list[str] = Field(..., min_length=1, max_length=10)
    max_budget_usdc: float = Field(..., gt=0, le=10_000)
    deadline_iso: str = Field(..., min_length=10, max_length=40)
    requires_human_approval: bool = Field(
        default=True,
        description="Must remain true unless the hosting app has an explicit spending policy",
    )

    @field_validator("requires_human_approval")
    @classmethod
    def require_human_approval(cls, value: bool) -> bool:
        """Require explicit approval for TaskMarket spending by default."""
        if value is not True:
            raise ValueError("TaskMarket delegation drafts require explicit human approval")
        return value
