from decimal import Decimal
from unittest.mock import patch

from cdp_agentkit_core.actions.compound.utils import (
    get_borrow_details,
    get_health_ratio,
    get_supply_details,
    get_token_decimals,
)

MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_COMPOUND_ADDRESS = "0xcompound_address"
MOCK_ASSET_ADDRESS = "0xasset_address"


def test_get_borrow_details(wallet_factory, asset_factory):
    """Test get_borrow_details function."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS

    # For USDC (assumed 6 decimals), raw "1000000000" yields 1000000000/1e6 = 1000.0 USDC
    mock_borrow_balance = "1000000000"  # raw value
    mock_base_token = "0xbase_token"
    # We rely on Asset.fetch to supply the symbol "USDC"
    mock_price_feed = "0xprice_feed"
    mock_price = "100000000000"  # raw, equals 1000.0 when divided by 1e8

    # Create an asset using asset_factory.
    asset = asset_factory(network_id="base-sepolia", asset_id="usdc", decimals=6, contract_address=mock_base_token)
    # Define the conversion helper.
    asset.from_atomic_amount = lambda atomic: atomic / Decimal(10**6)

    # Expected flow:
    # 1. borrowBalanceOf -> returns mock_borrow_balance
    # 2. baseToken -> returns mock_base_token
    # 3. baseTokenPriceFeed -> returns mock_price_feed
    # 4. getPrice -> returns mock_price
    with patch("cdp_agentkit_core.actions.compound.utils.Asset.fetch", return_value=asset), \
         patch("cdp.smart_contract.SmartContract.read", side_effect=[
             mock_borrow_balance,   # borrowBalanceOf
             mock_base_token,       # baseToken
             mock_price_feed,       # baseTokenPriceFeed
             mock_price,            # getPrice
         ]) as mock_contract_read:
        result = get_borrow_details(mock_wallet, MOCK_COMPOUND_ADDRESS)
        expected = {
            "Token Symbol": "usdc",
            "Borrow Amount": 1000.0,  # converted: 1000000000 / 1e6
            "Price": 1000.0           # (100000000000 / 1e8)
        }
        assert result == expected
        # Expect 4 SmartContract.read calls in this flow.
        assert mock_contract_read.call_count == 4


def test_get_supply_details(wallet_factory, asset_factory):
    """Test get_supply_details function."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS

    mock_num_assets = 1
    mock_asset_info = {
        "asset": MOCK_ASSET_ADDRESS,
        "priceFeed": "0xprice_feed",
        "borrowCollateralFactor": int(0.8 * 1e18),
    }
    # For WETH (assumed 18 decimals), a raw collateral balance of "1100000000000000000"
    # yields 1100000000000000000/1e18 = 1.1 ETH
    mock_collateral_balance = "1100000000000000000"  # raw collateral balance: 1.1 ETH
    # Asset.fetch will provide the token symbol "weth"
    mock_price = "100000000000"  # raw, equals 1000.0 when divided by 1e8

    # Create an asset for WETH.
    asset = asset_factory(
        network_id="base-sepolia", asset_id="weth", decimals=18, contract_address=MOCK_ASSET_ADDRESS
    )
    asset.from_atomic_amount = lambda atomic: atomic / Decimal(10**18)

    # Expected calls:
    # 1. numAssets -> returns mock_num_assets
    # 2. getAssetInfo -> returns mock_asset_info
    # 3. collateralBalanceOf -> returns mock_collateral_balance
    # 4. token symbol (via get_token_symbol) -> returns "weth"
    # 5. getPrice -> returns mock_price
    with patch("cdp_agentkit_core.actions.compound.utils.Asset.fetch", return_value=asset), \
         patch("cdp.smart_contract.SmartContract.read", side_effect=[
             mock_num_assets,          # numAssets
             mock_asset_info,          # getAssetInfo for asset
             mock_collateral_balance,  # collateralBalanceOf for collateral balance
             "weth",                   # token symbol from get_token_symbol
             mock_price,               # getPrice for asset price
         ]) as mock_contract_read:
        result = get_supply_details(mock_wallet, MOCK_COMPOUND_ADDRESS)
        expected = [{
            "Token Symbol": "weth",
            "Supply Amount": 1.1,     # converted: 1100000000000000000 / 1e18 = 1.1
            "Price": 1000.0,          # (100000000000 / 1e8)
            "Collateral Factor": 0.8
        }]
        assert len(result) == 1
        assert result[0] == expected[0]
        # Expect 5 SmartContract.read calls.
        assert mock_contract_read.call_count == 5


def test_get_health_ratio(wallet_factory):
    """Test get_health_ratio function."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS

    # Borrow details: For USDC, assume a human-readable value of 1000.0 USDC at $1.0 each.
    mock_borrow = {
        "Token Symbol": "usdc",
        "Borrow Amount": 1000.0,  # human-readable
        "Price": 1.0
    }
    # Supply details: For WETH, assume a human-readable supply of 1.0 ETH at $2000 each and collateral factor 0.8.
    # Collateral contribution = 1.0 * 2000 * 0.8 = 1600.
    mock_supply = [{
        "Token Symbol": "weth",
        "Supply Amount": 1.0,  # human-readable
        "Price": 2000.0,
        "Collateral Factor": 0.8
    }]

    with patch("cdp_agentkit_core.actions.compound.utils.get_borrow_details", return_value=mock_borrow), \
         patch("cdp_agentkit_core.actions.compound.utils.get_supply_details", return_value=mock_supply):
        health_ratio = get_health_ratio(mock_wallet, MOCK_COMPOUND_ADDRESS)
        # Health ratio = 1600 / 1000 = 1.6
        assert health_ratio == 1.6


def test_get_health_ratio_zero_borrow(wallet_factory):
    """Test get_health_ratio with zero borrows."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS

    mock_borrow = {
        "Token Symbol": "usdc",
        "Borrow Amount": 0,  # human-readable: 0 USDC
        "Price": 1.0
    }
    mock_supply = [{
        "Token Symbol": "weth",
        "Supply Amount": 1.0,  # human-readable
        "Price": 2000.0,
        "Collateral Factor": 0.8
    }]

    with patch("cdp_agentkit_core.actions.compound.utils.get_borrow_details", return_value=mock_borrow), \
         patch("cdp_agentkit_core.actions.compound.utils.get_supply_details", return_value=mock_supply):
        health_ratio = get_health_ratio(mock_wallet, MOCK_COMPOUND_ADDRESS)
        # With zero borrow, health ratio should be infinity.
        assert health_ratio == float('inf')


def test_get_token_decimals(wallet_factory):
    """Test get_token_decimals function."""
    mock_wallet = wallet_factory()
    mock_token_address = "0xtoken_address"
    expected_decimals = 6  # e.g., USDC has 6 decimals

    with patch("cdp.smart_contract.SmartContract.read", return_value=expected_decimals) as mock_contract_read:
        result = get_token_decimals(mock_wallet, mock_token_address)
        assert result == expected_decimals
        mock_contract_read.assert_called_once()
