"""
Triqee Action Provider Pydantic Schemas for Coinbase AgentKit Python SDK.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field

class GetLeadLagDivergenceSchema(BaseModel):
    """Input argument schema for querying Tokyo CEX vs Base DEX lead-lag divergence."""
    pair: Optional[str] = Field(
        default=None,
        description="Asset pair to inspect (e.g., 'cbBTC/USDC', 'WETH/USDC'). Defaults to all live pairs."
    )
    demo: Optional[bool] = Field(
        default=False,
        description="Set to True to use a complimentary 10-minute preview session token."
    )

class SimulateFlashflowArbitrageSchema(BaseModel):
    """Input argument schema for simulating zero-capital FlashFlow arbitrage."""
    pair: str = Field(
        description="Trading pair corridor (e.g., 'cbbtc_usdc', 'weth_usdc', 'b20_tbill')."
    )
    notional_usd: Optional[float] = Field(
        default=1000.0,
        description="Notional trade size in USD (default: 1000.0)."
    )

class GetB20InstitutionalCarrySchema(BaseModel):
    """Input argument schema for querying institutional B20 RWA positive carry."""
    asset_class: Optional[Literal["TREASURY", "REPO", "EQUITY", "ALL"]] = Field(
        default="ALL",
        description="Institutional asset class filter: TREASURY, REPO, EQUITY, or ALL."
    )
