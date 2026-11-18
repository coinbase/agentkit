"""Schemas for the LogicNodes action provider."""

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field


@dataclass
class LogicNodesConfig:
    """Configuration for the LogicNodes action provider."""

    # Override the default API base (useful for local dev / self-hosted)
    base_url: str = "https://logicnodes.io"

    # Optional API key for pre-paid access (skips x402 per-call payment)
    api_key: str = ""

    # Maximum payment per request in USDC whole units (x402 flow)
    max_payment_usdc: float = 1.0


class CallWorkerSchema(BaseModel):
    """Schema for calling any LogicNodes worker."""

    worker: str = Field(
        ...,
        description=(
            "The worker slug to call. Examples: 'loan_amortization_engine', "
            "'drug_interaction_oracle', 'anti_money_laundering_red_flag_scorer', "
            "'utility_bill_auditor', 'vehicle_vin_blockchain_resolver'. "
            "Use discover_logicnodes_workers to find available workers."
        ),
    )
    params: dict[str, Any] = Field(
        ...,
        description=(
            "Input parameters for the worker as a JSON object. "
            "Each worker has its own parameter schema — call discover_logicnodes_workers "
            "to see required fields for a specific worker."
        ),
    )

    class Config:
        """Pydantic config."""

        title = "Call a LogicNodes deterministic worker"


class DiscoverWorkersSchema(BaseModel):
    """Schema for discovering available workers."""

    category: str | None = Field(
        default=None,
        description=(
            "Optional category filter. Examples: 'finance', 'healthcare', 'legal', "
            "'logistics', 'aerospace', 'cybersecurity', 'energy', 'hr', 'compliance'. "
            "If omitted, returns all 624 workers."
        ),
    )
    keyword: str | None = Field(
        default=None,
        description="Optional keyword to filter workers by name. Example: 'mortgage', 'drug', 'fraud'.",
    )

    class Config:
        """Pydantic config."""

        title = "Discover available LogicNodes workers"


class FreeTryWorkerSchema(BaseModel):
    """Schema for free-trial worker call (no payment required)."""

    worker: str = Field(..., description="Worker slug to trial. One free call per worker per agent.")
    params: dict[str, Any] = Field(..., description="Input parameters for the worker.")

    class Config:
        """Pydantic config."""

        title = "Free trial call to a LogicNodes worker (one per agent per worker)"
