"""Tests for Compound schemas."""

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.compound.schemas import (
    CompoundBorrowSchema,
    CompoundPortfolioSchema,
    CompoundRepaySchema,
    CompoundSupplySchema,
    CompoundWithdrawSchema,
)


def test_supply_input_model_valid():
    """Test that CompoundSupplySchema schema accepts valid parameters."""
    valid_inputs = [
        {"asset_id": "weth", "amount": "0.125"},
        {"asset_id": "cbeth", "amount": "1.0"},
        {"asset_id": "cbbtc", "amount": "0.01"},
        {"asset_id": "wsteth", "amount": "2.5"},
        {"asset_id": "usdc", "amount": "1000"},
    ]
    for valid_input in valid_inputs:
        input_model = CompoundSupplySchema(**valid_input)
        assert input_model.asset_id == valid_input["asset_id"]
        assert input_model.amount == valid_input["amount"]


def test_supply_input_model_missing_params():
    """Test that CompoundSupplySchema schema raises error when params are missing."""
    with pytest.raises(ValidationError):
        CompoundSupplySchema(amount="0.125")  # Missing asset_id
    with pytest.raises(ValidationError):
        CompoundSupplySchema(asset_id="weth")  # Missing amount


def test_supply_input_model_invalid_asset():
    """Test that CompoundSupplySchema schema raises error for invalid asset_id."""
    with pytest.raises(ValidationError):
        CompoundSupplySchema(asset_id="invalid", amount="0.125")


def test_withdraw_input_model_valid():
    """Test that CompoundWithdrawSchema schema accepts valid parameters."""
    valid_inputs = [
        {"asset_id": "weth", "amount": "0.125"},
        {"asset_id": "cbeth", "amount": "1.0"},
        {"asset_id": "cbbtc", "amount": "0.01"},
        {"asset_id": "wsteth", "amount": "2.5"},
        {"asset_id": "usdc", "amount": "1000"},
    ]
    for valid_input in valid_inputs:
        input_model = CompoundWithdrawSchema(**valid_input)
        assert input_model.asset_id == valid_input["asset_id"]
        assert input_model.amount == valid_input["amount"]


def test_withdraw_input_model_missing_params():
    """Test that CompoundWithdrawSchema schema raises error when params are missing."""
    with pytest.raises(ValidationError):
        CompoundWithdrawSchema(amount="0.125")  # Missing asset_id
    with pytest.raises(ValidationError):
        CompoundWithdrawSchema(asset_id="weth")  # Missing amount


def test_withdraw_input_model_invalid_asset():
    """Test that CompoundWithdrawSchema schema raises error for invalid asset_id."""
    with pytest.raises(ValidationError):
        CompoundWithdrawSchema(asset_id="invalid", amount="0.125")


def test_borrow_input_model_valid():
    """Test that CompoundBorrowSchema schema accepts valid parameters."""
    valid_inputs = [
        {"asset_id": "weth", "amount": "0.5"},
        {"asset_id": "usdc", "amount": "1000"},
    ]
    for valid_input in valid_inputs:
        input_model = CompoundBorrowSchema(**valid_input)
        assert input_model.asset_id == valid_input["asset_id"]
        assert input_model.amount == valid_input["amount"]


def test_borrow_input_model_missing_params():
    """Test that CompoundBorrowSchema schema raises error when params are missing."""
    with pytest.raises(ValidationError):
        CompoundBorrowSchema(amount="0.5")  # Missing asset_id
    with pytest.raises(ValidationError):
        CompoundBorrowSchema(asset_id="weth")  # Missing amount


def test_borrow_input_model_invalid_asset():
    """Test that CompoundBorrowSchema schema raises error for invalid asset_id."""
    with pytest.raises(ValidationError):
        CompoundBorrowSchema(asset_id="cbeth", amount="0.5")  # Only weth and usdc allowed
    with pytest.raises(ValidationError):
        CompoundBorrowSchema(asset_id="invalid", amount="0.5")


def test_repay_input_model_valid():
    """Test that CompoundRepaySchema schema accepts valid parameters."""
    valid_inputs = [
        {"asset_id": "weth", "amount": "0.5"},
        {"asset_id": "usdc", "amount": "1000"},
    ]
    for valid_input in valid_inputs:
        input_model = CompoundRepaySchema(**valid_input)
        assert input_model.asset_id == valid_input["asset_id"]
        assert input_model.amount == valid_input["amount"]


def test_repay_input_model_missing_params():
    """Test that CompoundRepaySchema schema raises error when params are missing."""
    with pytest.raises(ValidationError):
        CompoundRepaySchema(amount="1000")  # Missing asset_id
    with pytest.raises(ValidationError):
        CompoundRepaySchema(asset_id="usdc")  # Missing amount


def test_repay_input_model_invalid_asset():
    """Test that CompoundRepaySchema schema raises error for invalid asset_id."""
    with pytest.raises(ValidationError):
        CompoundRepaySchema(asset_id="cbeth", amount="1000")  # Only weth and usdc allowed
    with pytest.raises(ValidationError):
        CompoundRepaySchema(asset_id="invalid", amount="1000")


def test_portfolio_input_model_valid():
    """Test that CompoundPortfolioSchema works with no parameters required."""
    input_model = CompoundPortfolioSchema()
    assert isinstance(input_model, CompoundPortfolioSchema)
