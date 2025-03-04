"""Schemas for the ERC20 action provider."""

from pydantic import BaseModel, Field, field_validator

from .validators import wei_amount_validator


class GetBalanceSchema(BaseModel):
    """Schema for getting the balance of an ERC20 token."""

    contract_address: str = Field(
        ...,
        description="The contract address of the token to get the balance for",
    )


class TransferSchema(BaseModel):
    """Schema for transferring ERC20 tokens."""

    amount: str = Field(description="The amount of the asset to transfer in wei")
    contract_address: str = Field(description="The contract address of the token to transfer")
    destination: str = Field(description="The destination to transfer the funds")

    @field_validator("amount")
    @classmethod
    def validate_wei_amount(cls, v: str) -> str:
        """Validate wei amount."""
        return wei_amount_validator(v)
