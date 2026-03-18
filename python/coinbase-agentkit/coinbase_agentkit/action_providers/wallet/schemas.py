"""Schemas for Wallet action provider."""

from pydantic import BaseModel, Field, field_validator

from ...validators.eth import validate_not_zero_address
from .validators import positive_decimal_validator


class GetWalletDetailsSchema(BaseModel):
    """Input schema for getting wallet details."""

    pass


class GetBalanceSchema(BaseModel):
    """Input schema for getting native currency balance."""

    pass


class NativeTransferSchema(BaseModel):
    """Input schema for native asset transfer."""

    to: str = Field(
        ...,
        description="The destination address to transfer to (e.g. '0x5154eae861cac3aa757d6016babaf972341354cf')",
    )
    value: str = Field(
        ..., description="The amount to transfer in whole units (e.g. '1.5' for 1.5 ETH)"
    )

    @field_validator("to")
    @classmethod
    def validate_to_address(cls, v: str) -> str:
        """Validate destination address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: str) -> str:
        """Validate the transfer value."""
        return positive_decimal_validator(v)


class ReturnNativeBalanceSchema(BaseModel):
    """Input schema for returning all native token balance to a destination address."""

    to: str = Field(
        ...,
        description="The destination address to receive all native token funds (e.g. '0x5154eae861cac3aa757d6016babaf972341354cf')",
    )

    @field_validator("to")
    @classmethod
    def validate_to_address(cls, v: str) -> str:
        """Validate destination address is a valid non-zero Ethereum address."""
        return validate_not_zero_address(v)
