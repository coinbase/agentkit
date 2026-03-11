"""Schemas for Superfluid action provider."""

from pydantic import BaseModel, Field, field_validator

from ...validators.eth import validate_not_zero_address


class CreateFlowSchema(BaseModel):
    """Input argument schema for creating a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")
    token_address: str = Field(..., description="The address of the token that will be streamed")
    flow_rate: str = Field(..., description="The flow rate of tokens in wei per second")

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, v: str) -> str:
        """Validate recipient address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)

    @field_validator("token_address")
    @classmethod
    def validate_token_address(cls, v: str) -> str:
        """Validate token address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)


class DeleteFlowSchema(BaseModel):
    """Input argument schema for deleting a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")
    token_address: str = Field(..., description="The address of the token being flowed")

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, v: str) -> str:
        """Validate recipient address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)

    @field_validator("token_address")
    @classmethod
    def validate_token_address(cls, v: str) -> str:
        """Validate token address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)


class UpdateFlowSchema(BaseModel):
    """Input argument schema for updating a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")
    token_address: str = Field(..., description="The address of the token that is being streamed")
    new_flow_rate: str = Field(..., description="The new flow rate of tokens in wei per second")

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, v: str) -> str:
        """Validate recipient address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)

    @field_validator("token_address")
    @classmethod
    def validate_token_address(cls, v: str) -> str:
        """Validate token address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)
