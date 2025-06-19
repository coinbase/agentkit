"""Schemas for Aave action provider."""

from typing import Literal

from pydantic import BaseModel, Field


class AaveSupplySchema(BaseModel):
    """Input schema for supplying assets to Aave."""

    asset_id: Literal["weth", "usdc", "cbeth", "wsteth"] = Field(
        ...,
        description="The asset ID to supply to the Aave market, one of `weth`, `usdc`, `cbeth`, or `wsteth`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to supply to the Aave market, e.g. `0.125` weth; `19.99` usdc",
    )
    on_behalf_of: str | None = Field(
        None,
        description="Optional address to supply assets on behalf of. Defaults to wallet address.",
    )
    referral_code: int = Field(
        0,
        description="Optional referral code. Default is 0.",
    )


class AaveWithdrawSchema(BaseModel):
    """Input schema for withdrawing assets from Aave."""

    asset_id: Literal["weth", "usdc", "cbeth", "wsteth"] = Field(
        ...,
        description="The asset ID to withdraw from the Aave market, one of `weth`, `usdc`, `cbeth`, or `wsteth`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to withdraw from the Aave market, e.g. `0.125` weth; `19.99` usdc. Use 'max' to withdraw all.",
    )
    to: str | None = Field(
        None,
        description="Optional address to withdraw assets to. Defaults to wallet address.",
    )


class AaveBorrowSchema(BaseModel):
    """Input schema for borrowing assets from Aave."""

    asset_id: Literal["weth", "usdc", "cbeth", "wsteth"] = Field(
        ...,
        description="The asset ID to borrow from the Aave market, one of `weth`, `usdc`, `cbeth`, or `wsteth`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to borrow from the Aave market, e.g. `0.125` weth; `19.99` usdc",
    )
    interest_rate_mode: int = Field(
        2,
        description="Interest rate mode: 1 for stable, 2 for variable. Default is variable (2).",
    )
    on_behalf_of: str | None = Field(
        None,
        description="Optional address to borrow assets on behalf of. Defaults to wallet address.",
    )
    referral_code: int = Field(
        0,
        description="Optional referral code. Default is 0.",
    )


class AaveRepaySchema(BaseModel):
    """Input schema for repaying borrowed assets to Aave."""

    asset_id: Literal["weth", "usdc", "cbeth", "wsteth"] = Field(
        ...,
        description="The asset ID to repay to the Aave market, one of `weth`, `usdc`, `cbeth`, or `wsteth`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to repay to the Aave market, e.g. `0.125` weth; `19.99` usdc. Use 'max' to repay all.",
    )
    interest_rate_mode: int = Field(
        2,
        description="Interest rate mode: 1 for stable, 2 for variable. Default is variable (2).",
    )
    on_behalf_of: str | None = Field(
        None,
        description="Optional address to repay debt for. Defaults to wallet address.",
    )


class AaveSetAsCollateralSchema(BaseModel):
    """Schema for setting an asset as collateral in Aave."""

    asset_id: str = Field(
        description="The asset ID to set as collateral, one of `weth`, `usdc`, `cbeth`, or `wsteth`",
    )
    use_as_collateral: bool = Field(
        default=True,
        description="Whether to use the asset as collateral (True) or not (False)",
    )


class AavePortfolioSchema(BaseModel):
    """Input schema for getting portfolio details from Aave."""

    account: str | None = Field(
        None,
        description="Optional address to get portfolio details for. Defaults to wallet address.",
    )
