"""Tests for the utility functions in Compound (utils.py)."""

from decimal import Decimal
from unittest.mock import MagicMock

from coinbase_agentkit.action_providers.compound.constants import (
    COMET_ABI,
    PRICE_FEED_ABI,
)
from coinbase_agentkit.action_providers.compound.utils import (
    format_amount_from_decimals,
    format_amount_with_decimals,
    get_collateral_balance,
    get_price_feed_data,
    get_token_balance,
    get_token_decimals,
    get_token_symbol,
)
from coinbase_agentkit.action_providers.erc20.constants import ERC20_ABI


def test_format_amount_with_decimals():
    """Test that format_amount_with_decimals converts a human-readable amount to an atomic amount."""
    # "1.0" with 18 decimals should equal 10^18
    assert format_amount_with_decimals("1.0", 18) == int(Decimal("1.0") * Decimal(10**18))
    # "0.5" with 18 decimals should equal 5*10^17
    assert format_amount_with_decimals("0.5", 18) == int(Decimal("0.5") * Decimal(10**18))
    # "1.25" with 2 decimals should equal 125
    assert format_amount_with_decimals("1.25", 2) == int(Decimal("1.25") * Decimal(10**2))


def test_format_amount_from_decimals():
    """Test that format_amount_from_decimals converts a number to a human-readable amount."""
    # 10^18 with 18 decimals should be "1"
    assert format_amount_from_decimals(int(Decimal(10**18)), 18) == "1"
    # 5*10^17 with 18 decimals should be "0.5"
    assert format_amount_from_decimals(int(Decimal("0.5") * Decimal(10**18)), 18) == "0.5"
    # 125 with 2 decimals should be "1.25"
    assert format_amount_from_decimals(125, 2) == "1.25"


def test_get_price_feed_data():
    """Test that get_price_feed_data returns the values provided by the wallet.read_contract."""
    # Create a mock wallet
    mock_wallet = MagicMock()

    # Set up the mock to return a tuple similar to latestRoundData
    mock_wallet.read_contract.return_value = (0, 123456789, 0, 1617181920, 0)

    price, updated_at = get_price_feed_data(mock_wallet, "0xDummyPriceFeed")

    # Verify the correct method was called
    mock_wallet.read_contract.assert_called_once_with(
        "0xDummyPriceFeed", PRICE_FEED_ABI, "latestRoundData"
    )

    assert price == 123456789
    assert updated_at == 1617181920


def test_get_collateral_balance():
    """Test that get_collateral_balance returns a dummy collateral balance."""
    # Create a mock wallet with an address
    mock_wallet = MagicMock()
    mock_wallet.get_address.return_value = "0xDummyWallet"

    # Set up the mock to return a balance
    mock_wallet.read_contract.return_value = 5000

    balance = get_collateral_balance(mock_wallet, "0xCompoundMarket", "0xAsset")

    # Verify the correct method was called
    mock_wallet.read_contract.assert_called_once_with(
        "0xCompoundMarket", COMET_ABI, "collateralBalanceOf", args=["0xDummyWallet", "0xAsset"]
    )

    assert balance == 5000


def test_get_token_decimals():
    """Test that get_token_decimals returns a predetermined value."""
    # Create a mock wallet
    mock_wallet = MagicMock()

    # Set up the mock to return decimals
    mock_wallet.read_contract.return_value = 18

    decimals = get_token_decimals(mock_wallet, "0xToken")

    # Verify the correct method was called
    mock_wallet.read_contract.assert_called_once_with("0xToken", ERC20_ABI, "decimals")

    assert decimals == 18


def test_get_token_symbol():
    """Test that get_token_symbol returns a predetermined symbol."""
    # Create a mock wallet
    mock_wallet = MagicMock()

    # Set up the mock to return a symbol
    mock_wallet.read_contract.return_value = "WETH"

    symbol = get_token_symbol(mock_wallet, "0xToken")

    # Verify the correct method was called
    mock_wallet.read_contract.assert_called_once_with("0xToken", ERC20_ABI, "symbol")

    assert symbol == "WETH"


def test_get_token_balance():
    """Test that get_token_balance returns a dummy balance."""
    # Create a mock wallet with a default address
    mock_wallet = MagicMock()
    mock_wallet.default_address.address_id = "0xDefaultAddress"
    # Make sure get_address() returns the expected default address.
    mock_wallet.get_address.return_value = "0xDefaultAddress"

    # Set up the mock to return a balance
    mock_wallet.read_contract.return_value = 1000

    balance = get_token_balance(mock_wallet, "0xToken")

    # Verify the correct method was called
    mock_wallet.read_contract.assert_called_once_with(
        "0xToken", ERC20_ABI, "balanceOf", args=["0xDefaultAddress"]
    )

    assert balance == 1000
