"""Schemas for Compound action provider."""

from typing import Literal

from pydantic import BaseModel, Field


class CompoundSupplyInput(BaseModel):
    """Input schema for supplying assets to Compound."""

    asset_id: Literal["weth", "cbeth", "cbbtc", "wsteth", "usdc"] = Field(
        ...,
        description="The asset ID to supply to the Compound market, one of `weth`, `cbeth`, `cbbtc`, `wsteth`, or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to supply to the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


class CompoundWithdrawInput(BaseModel):
    """Input schema for withdrawing assets from Compound."""

    asset_id: Literal["weth", "cbeth", "cbbtc", "wsteth", "usdc"] = Field(
        ...,
        description="The asset ID to withdraw from the Compound market, one of `weth`, `cbeth`, `cbbtc`, `wsteth`, or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to withdraw from the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


class CompoundBorrowInput(BaseModel):
    """Input schema for borrowing assets from Compound."""

    asset_id: Literal["weth", "usdc"] = Field(
        ...,
        description="The asset ID to borrow from the Compound market, either `weth` or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to borrow from the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


class CompoundRepayInput(BaseModel):
    """Input schema for repaying borrowed assets to Compound."""

    asset_id: Literal["weth", "usdc"] = Field(
        ...,
        description="The asset ID to repay to the Compound market, either `weth` or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to repay to the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


class CompoundPortfolioInput(BaseModel):
    """Input schema for getting portfolio details from Compound."""

    pass  # No inputs required, matches CDP Agentkit Core implementation
