"""Schemas for Basename action provider."""

from pydantic import BaseModel, Field


class RegisterBasenameSchema(BaseModel):
    """Input argument schema for registering a Basename."""

    basename: str = Field(
        ...,
        description="The Basename to assign to the agent (e.g., `example.base.eth` or `example.basetest.eth`)",
    )
    amount: str = Field(
        ..., description="The amount of Eth to pay for registration. The default is set to 0.002."
    )
