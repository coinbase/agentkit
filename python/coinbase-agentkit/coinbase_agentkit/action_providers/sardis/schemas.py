"""Schemas for Sardis action provider."""

from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _validate_positive_amount(value: str) -> str:
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("amount must be a decimal string") from exc

    if not amount.is_finite() or amount <= 0:
        raise ValueError("amount must be greater than zero")

    return value


class SardisPaySchema(BaseModel):
    """Input argument schema for executing a policy-controlled payment."""

    to: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description='Recipient address or merchant identifier (e.g. "0xabc...", "openai.com", "anthropic:api")',
    )
    amount: str = Field(
        ...,
        max_length=32,
        description='Payment amount in token units (e.g. "25.00")',
    )
    token: Literal["USDC", "USDT", "PYUSD", "EURC"] = Field(
        default="USDC",
        description="Token to pay with. Supported: USDC, USDT, PYUSD, EURC",
    )
    purpose: str = Field(
        default="",
        max_length=512,
        description='Human-readable reason for the payment (e.g. "Monthly API subscription")',
    )

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: str) -> str:
        """Validate payment amount syntax and sign."""
        return _validate_positive_amount(value)


class SardisCheckBalanceSchema(BaseModel):
    """Input argument schema for checking wallet balance and spending limits."""

    token: Literal["USDC", "USDT", "PYUSD", "EURC"] = Field(
        default="USDC", description="Token to query (default: USDC)"
    )
    chain: Literal["base", "ethereum", "polygon", "arbitrum", "optimism"] = Field(
        default="base", description="Blockchain network (default: base)"
    )


class SardisCheckPolicySchema(BaseModel):
    """Input argument schema for dry-run policy validation."""

    to: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Recipient address or merchant identifier",
    )
    amount: str = Field(
        ...,
        max_length=32,
        description="Payment amount to validate",
    )
    token: Literal["USDC", "USDT", "PYUSD", "EURC"] = Field(
        default="USDC", description="Token type (default: USDC)"
    )
    purpose: str = Field(
        default="",
        max_length=512,
        description="Payment purpose (some policies require this)",
    )

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: str) -> str:
        """Validate policy-check amount syntax and sign."""
        return _validate_positive_amount(value)


class SardisSetPolicySchema(BaseModel):
    """Input argument schema for setting a spending policy."""

    policy_text: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description='Natural language policy description (e.g. "Max $50 per transaction, daily limit $500")',
    )
    max_per_tx: str = Field(
        default="",
        description="Optional explicit per-transaction limit override",
    )
    max_total: str = Field(
        default="",
        description="Optional explicit total spending limit override",
    )


class SardisListTransactionsSchema(BaseModel):
    """Input argument schema for listing recent transactions."""

    limit: int = Field(
        default=10,
        ge=1,
        description="Maximum number of transactions to return (default: 10, max: 50)",
    )
