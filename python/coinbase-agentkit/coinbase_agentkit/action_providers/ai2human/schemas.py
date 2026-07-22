"""Schemas for AI2Human action provider."""

from pydantic import BaseModel, Field


class CreateTaskSchema(BaseModel):
    """Input schema for creating a human-execution task."""

    title: str = Field(..., description="One-line summary of the blocked workflow step.")
    description: str = Field(..., description="Bounded instructions for the human operator.")
    category: str = Field(
        ...,
        description=(
            "Task category: local_verification, identity_action, physical_task, "
            "digital_task, compliance_check, or errand."
        ),
    )
    proof_requirements: list[str] = Field(
        ...,
        description=(
            "Proof types the human must submit. One or more of: screenshot, photo, "
            "url, timestamp, receipt, signature, notes."
        ),
    )
    reward_usdc: float = Field(..., description="Payment reward in USDC.", gt=0)
    deadline_hours: float = Field(..., description="Deadline measured in hours.", gt=0)
    location: str | None = Field(None, description="Optional physical location.")
    agent_name: str | None = Field(None, description="Optional name of the calling agent.")
    acceptance_criteria: str | None = Field(
        None, description="Exact success condition the human proof must satisfy."
    )


class TaskIdSchema(BaseModel):
    """Input schema for checking or retrieving an AI2Human task."""

    task_id: str = Field(..., description="AI2Human task identifier returned by create_task.")


class ListCategoriesSchema(BaseModel):
    """Input schema for listing supported categories. No fields required."""

    pass
