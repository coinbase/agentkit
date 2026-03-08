"""Schemas for Sardis action provider."""

from pydantic import BaseModel, Field


class SardisPaySchema(BaseModel):
    """Input argument schema for executing a policy-controlled payment."""

    to: str = Field(
        ...,
        description='Recipient address or merchant identifier (e.g. "0xabc...", "openai.com", "anthropic:api")',
    )
    amount: str = Field(
        ..., description='Payment amount in token units (e.g. "25.00")'
    )
    token: str = Field(
        default="USDC",
        description="Token to pay with. Supported: USDC, USDT, PYUSD, EURC",
    )
    purpose: str = Field(
        default="",
        description='Human-readable reason for the payment (e.g. "Monthly API subscription")',
    )


class SardisCheckBalanceSchema(BaseModel):
    """Input argument schema for checking wallet balance and spending limits."""

    token: str = Field(
        default="USDC", description="Token to query (default: USDC)"
    )
    chain: str = Field(
        default="base", description="Blockchain network (default: base)"
    )


class SardisCheckPolicySchema(BaseModel):
    """Input argument schema for dry-run policy validation."""

    to: str = Field(..., description="Recipient address or merchant identifier")
    amount: str = Field(..., description="Payment amount to validate")
    token: str = Field(default="USDC", description="Token type (default: USDC)")
    purpose: str = Field(
        default="", description="Payment purpose (some policies require this)"
    )


class SardisSetPolicySchema(BaseModel):
    """Input argument schema for setting a spending policy."""

    policy_text: str = Field(
        ...,
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
        description="Maximum number of transactions to return (default: 10, max: 50)",
    )
