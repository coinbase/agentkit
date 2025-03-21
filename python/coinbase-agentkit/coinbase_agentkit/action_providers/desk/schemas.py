"""Schemas for DESK action provider."""

from desk.enum import MarketSymbol, OrderSide, OrderType, TimeInForce
from pydantic import BaseModel, Field


class GetLastTradesSchema(BaseModel):
    """Schema for get_last_trades action."""

    symbol: str = Field(..., description="The symbol of the asset to get trades for")


class GetCurrentFundingRateSchema(BaseModel):
    """Schema for get_current_funding_rate action."""

    symbol: str = Field(..., description="The symbol of the asset to get funding rate for")


class GetHistoricalFundingRatesSchema(BaseModel):
    """Schema for get_historical_funding_rates action."""

    symbol: str = Field(
        ..., description="The symbol of the asset to get historical funding rates for"
    )
    start_time: int = Field(
        ..., description="The start time (in seconds) to get historical funding rates for"
    )
    end_time: int = Field(
        ..., description="The end time (in seconds) to get historical funding rates for"
    )


class PlaceOrderSchema(BaseModel):
    """Schema for place_order action."""

    symbol: str = Field(
        ..., description=f"The symbol of the asset to trade, e.g. {[e.value for e in MarketSymbol]}"
    )
    side: str = Field(..., description=f"The side of the order ({[e.value for e in OrderSide]})")
    amount: str = Field(..., description="The amount of the asset to trade")
    price: str = Field(..., description="The price of the asset to trade")
    order_type: str = Field(..., description=f"The type of order ({[e.value for e in OrderType]})")
    reduce_only: bool | None = Field(
        None, description="Whether the order is reduce-only. Should be true if closing a position."
    )
    trigger_price: str | None = Field(None, description="The trigger price for stop orders")
    time_in_force: str | None = Field(
        None, description=f"Time in force for the order ({[e.value for e in TimeInForce]})"
    )
    wait_for_reply: bool = Field(True, description="Whether to wait for reply")
    client_order_id: str | None = Field(None, description="Client order ID")


class CancelOrderSchema(BaseModel):
    """Schema for cancel_order action."""

    symbol: str = Field(
        ..., description=f"The symbol of the asset ({[e.value for e in MarketSymbol]})"
    )
    is_conditional_order: bool = Field(..., description="Whether this is a conditional order")
    order_digest: str | None = Field(None, description="The order digest to cancel")
    wait_for_reply: bool = Field(True, description="Whether to wait for reply from the server")
    client_order_id: str | None = Field(None, description="Client order ID for tracking")


class CancelAllOrdersSchema(BaseModel):
    """Schema for cancel_all_orders action."""

    symbol: str | None = Field(
        None, description=f"The symbol of the asset ({[e.value for e in MarketSymbol]})"
    )
    is_conditional_order: bool = Field(False, description="Whether to cancel conditional orders")
    wait_for_reply: bool = Field(True, description="Whether to wait for reply from the server")


class DepositCollateralSchema(BaseModel):
    """Schema for deposit_collateral action."""

    asset: str = Field(..., description="The asset to deposit ('USDC')")
    amount: float = Field(..., description="The amount to deposit")


class WithdrawCollateralSchema(BaseModel):
    """Schema for withdraw_collateral action."""

    asset: str = Field(..., description="The asset to withdraw ('USDC')")
    amount: float = Field(..., description="The amount to withdraw")
