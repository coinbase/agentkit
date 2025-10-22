"""Schemas for Morpho action provider."""

from pydantic import BaseModel, Field


class MorphoDepositSchema(BaseModel):
    """Input schema for Morpho Vault deposit action."""

    assets: str = Field(..., description="The quantity of assets to deposit, in whole units")
    receiver: str = Field(
        ...,
        description="The address that will own the position on the vault which will receive the shares",
    )
    token_address: str = Field(
        ..., description="The address of the assets token to approve for deposit"
    )
    vault_address: str = Field(..., description="The address of the Morpho Vault to deposit to")


class MorphoWithdrawSchema(BaseModel):
    """Input schema for Morpho Vault withdraw action."""

    vault_address: str = Field(..., description="The address of the Morpho Vault to withdraw from")
    assets: str = Field(..., description="The amount of assets to withdraw in atomic units")
    receiver: str = Field(..., description="The address to receive the withdrawn assets")
