"""Schemas for Superfluid action provider."""

from pydantic import BaseModel, Field


class CreateFlowSchema(BaseModel):
    """Input argument schema for creating a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")
    token_address: str = Field(..., description="The address of the token that will be streamed")
    flow_rate: str = Field(..., description="The flow rate of tokens in wei per second")


class DeleteFlowSchema(BaseModel):
    """Input argument schema for deleting a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")
    token_address: str = Field(..., description="The address of the token being flowed")


class UpdateFlowSchema(BaseModel):
    """Input argument schema for updating a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")
    token_address: str = Field(..., description="The address of the token that is being streamed")
    new_flow_rate: str = Field(..., description="The new flow rate of tokens in wei per second")
