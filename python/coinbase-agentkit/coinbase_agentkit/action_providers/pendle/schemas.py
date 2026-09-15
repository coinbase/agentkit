"""Schemas for Pendle action provider."""

from pydantic import BaseModel, Field


class PendleSwapTokenForPtSchema(BaseModel):
    """Input schema for buying Principal Token (PT) on a Pendle market."""

    market_address: str = Field(
        ...,
        description="Address of the Pendle market on the current chain.",
    )
    token_in_address: str = Field(
        ...,
        description=(
            "Address of the input ERC-20 (the asset spent to buy PT). "
            "For PT-USDe this might be USDC or USDT."
        ),
    )
    amount: str = Field(
        ...,
        description="Human-readable amount of token_in to spend, e.g. `100` USDC.",
    )
    slippage: float = Field(
        0.005,
        description="Maximum slippage tolerance as a decimal (default 0.005 = 0.5%).",
    )


class PendleSwapPtForTokenSchema(BaseModel):
    """Input schema for selling Principal Token (PT) on a Pendle market."""

    market_address: str = Field(
        ...,
        description="Address of the Pendle market on the current chain.",
    )
    token_out_address: str = Field(
        ...,
        description="Address of the ERC-20 to receive (e.g. USDC, USDT, WETH).",
    )
    pt_amount: str = Field(
        ...,
        description="Human-readable amount of PT to sell, e.g. `100`.",
    )
    slippage: float = Field(
        0.005,
        description="Maximum slippage tolerance as a decimal (default 0.005 = 0.5%).",
    )


class PendleMarketInfoSchema(BaseModel):
    """Input schema for reading details of a Pendle market."""

    market_address: str = Field(
        ...,
        description="Address of the Pendle market on the current chain.",
    )
