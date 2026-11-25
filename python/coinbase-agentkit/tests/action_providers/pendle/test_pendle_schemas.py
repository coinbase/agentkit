import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.pendle.schemas import (
    PendleMarketInfoSchema,
    PendleSwapPtForTokenSchema,
    PendleSwapTokenForPtSchema,
)


def test_swap_token_for_pt_schema_valid():
    """Required fields produce a valid schema with default slippage."""
    schema = PendleSwapTokenForPtSchema(
        market_address="0x2222222222222222222222222222222222222222",
        token_in_address="0x3333333333333333333333333333333333333333",
        amount="100",
    )
    assert schema.amount == "100"
    assert schema.slippage == 0.005


def test_swap_token_for_pt_schema_custom_slippage():
    """Slippage is overridable."""
    schema = PendleSwapTokenForPtSchema(
        market_address="0x2",
        token_in_address="0x3",
        amount="100",
        slippage=0.02,
    )
    assert schema.slippage == 0.02


def test_swap_token_for_pt_schema_missing_field():
    """Missing required field raises ValidationError."""
    with pytest.raises(ValidationError):
        PendleSwapTokenForPtSchema(token_in_address="0x3", amount="100")

    with pytest.raises(ValidationError):
        PendleSwapTokenForPtSchema(market_address="0x2", amount="100")


def test_swap_pt_for_token_schema_valid():
    """Required fields produce a valid sell-PT schema."""
    schema = PendleSwapPtForTokenSchema(
        market_address="0x2",
        token_out_address="0x4",
        pt_amount="50",
    )
    assert schema.pt_amount == "50"
    assert schema.slippage == 0.005


def test_swap_pt_for_token_schema_missing_field():
    """Missing required field raises ValidationError."""
    with pytest.raises(ValidationError):
        PendleSwapPtForTokenSchema(token_out_address="0x4", pt_amount="50")


def test_market_info_schema_valid():
    """Single required field produces a valid schema."""
    schema = PendleMarketInfoSchema(market_address="0x2")
    assert schema.market_address == "0x2"


def test_market_info_schema_missing_field():
    """Missing market_address raises ValidationError."""
    with pytest.raises(ValidationError):
        PendleMarketInfoSchema()
