import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.aave.schemas import (
    AaveBorrowSchema,
    AavePortfolioSchema,
    AaveRepaySchema,
    AaveSetAsCollateralSchema,
    AaveSupplySchema,
    AaveWithdrawSchema,
)


def test_aave_supply_schema_valid():
    """Test that AaveSupplySchema validates correct inputs."""
    # Test with minimal valid input
    schema = AaveSupplySchema(asset_id="weth", amount="1.0")
    assert schema.asset_id == "weth"
    assert schema.amount == "1.0"
    assert schema.referral_code == 0
    assert schema.on_behalf_of is None

    # Test with all fields
    schema = AaveSupplySchema(
        asset_id="usdc", amount="100", referral_code=123, on_behalf_of="0xsomeaddress"
    )
    assert schema.asset_id == "usdc"
    assert schema.amount == "100"
    assert schema.referral_code == 123
    assert schema.on_behalf_of == "0xsomeaddress"


def test_aave_supply_schema_invalid():
    """Test that AaveSupplySchema rejects invalid inputs."""
    # Missing required fields
    with pytest.raises(ValidationError):
        AaveSupplySchema()

    with pytest.raises(ValidationError):
        AaveSupplySchema(asset_id="weth")

    with pytest.raises(ValidationError):
        AaveSupplySchema(amount="1.0")

    # Invalid referral code (not an integer)
    with pytest.raises(ValidationError):
        AaveSupplySchema(asset_id="weth", amount="1.0", referral_code="abc")


def test_aave_withdraw_schema_valid():
    """Test that AaveWithdrawSchema validates correct inputs."""
    # Test with minimal valid input
    schema = AaveWithdrawSchema(asset_id="weth", amount="1.0")
    assert schema.asset_id == "weth"
    assert schema.amount == "1.0"
    assert schema.to is None

    # Test with all fields
    schema = AaveWithdrawSchema(asset_id="usdc", amount="100", to="0xsomeaddress")
    assert schema.asset_id == "usdc"
    assert schema.amount == "100"
    assert schema.to == "0xsomeaddress"


def test_aave_borrow_schema_valid():
    """Test that AaveBorrowSchema validates correct inputs."""
    # Test with minimal valid input
    schema = AaveBorrowSchema(asset_id="weth", amount="1.0")
    assert schema.asset_id == "weth"
    assert schema.amount == "1.0"
    assert schema.interest_rate_mode == 2  # Variable rate by default
    assert schema.referral_code == 0
    assert schema.on_behalf_of is None

    # Test with all fields
    schema = AaveBorrowSchema(
        asset_id="usdc",
        amount="100",
        interest_rate_mode=1,  # Stable rate
        referral_code=123,
        on_behalf_of="0xsomeaddress",
    )
    assert schema.asset_id == "usdc"
    assert schema.amount == "100"
    assert schema.interest_rate_mode == 1
    assert schema.referral_code == 123
    assert schema.on_behalf_of == "0xsomeaddress"


def test_aave_repay_schema_valid():
    """Test that AaveRepaySchema validates correct inputs."""
    # Test with minimal valid input
    schema = AaveRepaySchema(asset_id="weth", amount="1.0")
    assert schema.asset_id == "weth"
    assert schema.amount == "1.0"
    assert schema.interest_rate_mode == 2  # Variable rate by default
    assert schema.on_behalf_of is None

    # Test with all fields
    schema = AaveRepaySchema(
        asset_id="usdc",
        amount="100",
        interest_rate_mode=1,  # Stable rate
        on_behalf_of="0xsomeaddress",
    )
    assert schema.asset_id == "usdc"
    assert schema.amount == "100"
    assert schema.interest_rate_mode == 1
    assert schema.on_behalf_of == "0xsomeaddress"


def test_aave_portfolio_schema_valid():
    """Test that AavePortfolioSchema validates correct inputs."""
    # Test with minimal valid input (empty dict is valid)
    schema = AavePortfolioSchema()
    assert schema.account is None

    # Test with account specified
    schema = AavePortfolioSchema(account="0xsomeaddress")
    assert schema.account == "0xsomeaddress"


def test_aave_set_collateral_schema_valid():
    """Test that AaveSetAsCollateralSchema validates correct inputs."""
    # Test with minimal valid input
    schema = AaveSetAsCollateralSchema(asset_id="weth", use_as_collateral=True)
    assert schema.asset_id == "weth"
    assert schema.use_as_collateral is True

    schema = AaveSetAsCollateralSchema(asset_id="usdc", use_as_collateral=False)
    assert schema.asset_id == "usdc"
    assert schema.use_as_collateral is False


def test_aave_set_collateral_schema_invalid():
    """Test that AaveSetAsCollateralSchema rejects invalid inputs."""
    # Missing required fields
    with pytest.raises(ValidationError):
        AaveSetAsCollateralSchema()

    # Test without asset_id (which is required)
    with pytest.raises(ValidationError):
        AaveSetAsCollateralSchema(use_as_collateral=True)

    # Test with invalid asset_id (if literals are enforced)
    # Note: The schema doesn't specify Literal for asset_id but the UI hints
    # suggest it should accept specific values
    # If validation fails in future, this test should be modified
    # or the schema should be updated to use Literal
