"""Schemas for the ERC20 action provider."""

import re
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError


class GetBalanceSchema(BaseModel):
    """Schema for getting the balance of an ERC20 token."""

    contract_address: str = Field(
        ...,
        description="The contract address of the token to get the balance for",
    )
    address: str | None = Field(
        None,
        description="The address to check the balance for. If not provided, uses the wallet's address",
    )


class TransferSchema(BaseModel):
    """Schema for transferring ERC20 tokens."""

    amount: str = Field(
        description="The amount of the asset to transfer in whole units (e.g. 1.5 USDC)"
    )
    contract_address: str = Field(description="The contract address of the token to transfer")
    destination_address: str = Field(description="The destination to transfer the funds")

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate amount is a positive decimal number."""
        pattern = r"^[0-9]*\.?[0-9]+$"
        if not re.match(pattern, v):
            raise PydanticCustomError(
                "decimal_format",
                "Amount must be a positive decimal number",
                {"value": v},
            )

        try:
            decimal_value = Decimal(v)
            if decimal_value <= 0:
                raise PydanticCustomError(
                    "positive_amount",
                    "Amount must be greater than 0",
                    {"value": v},
                )
        except (ValueError, TypeError, ArithmeticError) as e:
            raise PydanticCustomError(
                "decimal_parse",
                "Failed to parse decimal value",
                {"error": str(e)},
            ) from e

        return v


class GetTokenAddressSchema(BaseModel):
    """Schema for getting token address by symbol."""

    symbol: str = Field(
        ...,
        description="The token symbol (e.g., USDC, WETH, CBBTC)",
    )

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        """Convert symbol to uppercase and validate length."""
        upper = v.upper()
        if len(upper) < 1 or len(upper) > 10:
            raise PydanticCustomError(
                "symbol_length",
                "Symbol must be between 1 and 10 characters",
                {"value": v},
            )
        return upper


class ApproveSchema(BaseModel):
    """Schema for approving token spending."""

    amount: str = Field(
        description="The amount to approve in whole units (e.g. 100.2 for 100.2 USDC)"
    )
    contract_address: str = Field(description="The contract address of the token")
    spender_address: str = Field(description="The address to approve for spending tokens")

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate amount is a positive decimal number."""
        pattern = r"^[0-9]*\.?[0-9]+$"
        if not re.match(pattern, v):
            raise PydanticCustomError(
                "decimal_format",
                "Amount must be a positive decimal number",
                {"value": v},
            )

        try:
            decimal_value = Decimal(v)
            if decimal_value < 0:
                raise PydanticCustomError(
                    "non_negative_amount",
                    "Amount must be greater than or equal to 0",
                    {"value": v},
                )
        except (ValueError, TypeError, ArithmeticError) as e:
            raise PydanticCustomError(
                "decimal_parse",
                "Failed to parse decimal value",
                {"error": str(e)},
            ) from e

        return v


class AllowanceSchema(BaseModel):
    """Schema for checking token allowance."""

    contract_address: str = Field(
        ...,
        description="The contract address of the token",
    )
    spender_address: str = Field(
        ...,
        description="The address to check allowance for",
    )
