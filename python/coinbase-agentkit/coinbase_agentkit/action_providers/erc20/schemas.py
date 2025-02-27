"""Schemas for the ERC20 action provider."""

from pydantic import BaseModel, Field


class GetBalanceSchema(BaseModel):
    """Schema for getting the balance of an ERC20 token."""

    contract_address: str = Field(
        ...,
        description="The contract address of the token to get the balance for",
    )


class TransferSchema(BaseModel):
    """Schema for transferring ERC20 tokens."""

    amount: str = Field(
        description="The amount of the asset to transfer, in human-readable format (e.g. 1 USDC, 0.01 WETH)"
    )
    contract_address: str = Field(description="The contract address of the token to transfer")
    destination: str = Field(description="The destination to transfer the funds")
