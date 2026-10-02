"""Schemas for Agenda Financial Guard action provider."""

from pydantic import BaseModel, Field


class CheckTransactionSafetySchema(BaseModel):
    """Input schema for checking transaction safety against financial guardrails."""

    recipient: str = Field(
        ...,
        description="Destination wallet or smart contract address (e.g. 0xd90e2f925da726b50c4ed8d0fb90ad053324f31b)",
    )
    amount_usd: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
        description="Caller-reported transaction value in USD equivalent to evaluate against velocity and single-action limits",
    )
    network: str = Field(
        default="base",
        description="Target blockchain network (e.g. base, ethereum, arbitrum, optimism)",
    )
    token: str = Field(
        default="USDC",
        description="Token symbol being transferred or approved (e.g. USDC, ETH, USDT)",
    )
    calldata: str = Field(
        default="0x",
        description="Hex-encoded smart contract calldata (used to detect drainers and infinite token approvals)",
    )
    intent: str = Field(
        default="Autonomous agent transaction",
        description="Natural language explanation of why the agent is executing this transaction",
    )

    velocity_24h_usd: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
        description="Optional caller-reported prior 24h spending; unverified and never wallet authorization",
    )
