from unittest.mock import patch

from cdp.errors import ApiError, ApiException

from cdp_agentkit_core.actions.compound.constants import (
    CUSDCV3_MAINNET_ADDRESS,
    CUSDCV3_TESTNET_ADDRESS,
)
from cdp_agentkit_core.actions.compound.portfolio_details import get_portfolio_details


def test_get_portfolio_details_with_data_mainnet(wallet_factory, asset_factory):
    """Test get_portfolio_details function for a wallet on mainnet with supplied and borrowed data."""
    # Use wallet_factory instead of direct Mock creation
    wallet = wallet_factory(network_id="base-mainnet")

    # Setup mocked data for supply and borrow details and health ratio.
    supply_details = [
        {
            "Token Symbol": "usdc",
            "Supply Amount": 100,
            "Price": 1.00,
            "Collateral Factor": 0.75,
        }
    ]
    borrow_details = {
        "Token Symbol": "usdc",
        "Borrow Amount": 50,
        "Price": 1.00,
    }
    health_ratio = 1.5

    with patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_supply_details",
        return_value=supply_details,
    ) as mock_get_supply, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_borrow_details",
        return_value=borrow_details,
    ) as mock_get_borrow, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_health_ratio",
        return_value=health_ratio,
    ) as mock_get_health, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.Asset.fetch",
        return_value=asset_factory(
            network_id="base-mainnet", asset_id="usdc", decimals=6
        ),
    ):
        result = get_portfolio_details(wallet)

        # Verify that the helper functions are called with the correct compound address.
        mock_get_supply.assert_called_once_with(wallet, CUSDCV3_MAINNET_ADDRESS)
        mock_get_borrow.assert_called_once_with(wallet, CUSDCV3_MAINNET_ADDRESS)
        mock_get_health.assert_called_once_with(wallet, CUSDCV3_MAINNET_ADDRESS)

        # Check that the formatted output contains the expected markdown sections.
        assert "# Portfolio Details" in result
        assert "## Supply Details" in result
        assert "### usdc" in result
        assert "- **Supply Amount:** 100.000000" in result
        assert "- **Price:** $1.00" in result
        # Collateral factor is still divided by 1e18 so note it may not show exactly "0.75"
        assert "- **Collateral Factor:**" in result
        assert "- **Asset Value:** $100.00" in result
        assert "### Total Supply Value: $100.00" in result
        assert "## Borrow Details" in result
        assert "- **Borrow Amount:** 50.000000" in result
        assert "- **Price:** $1.00" in result
        assert "- **Borrow Value:** $50.00" in result
        assert "## Overall Health" in result
        assert "- **Health Ratio:** 1.50" in result

def test_get_portfolio_details_without_data_testnet(wallet_factory):
    """Test get_portfolio_details function for a wallet on testnet with no supplied or borrowed assets."""
    # Use wallet_factory instead of direct Mock creation
    wallet = wallet_factory(network_id="base-sepolia")

    # Setup mocked data: no supply details and borrowed amount is zero.
    supply_details = []
    borrow_details = {"Borrow Amount": 0}  # No borrowed assets.
    health_ratio = 5.0

    with patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_supply_details",
        return_value=supply_details,
    ) as mock_get_supply, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_borrow_details",
        return_value=borrow_details,
    ) as mock_get_borrow, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_health_ratio",
        return_value=health_ratio,
    ) as mock_get_health:
        result = get_portfolio_details(wallet)

        # Verify that the utility functions are called with the correct compound address for testnet.
        mock_get_supply.assert_called_once_with(wallet, CUSDCV3_TESTNET_ADDRESS)
        mock_get_borrow.assert_called_once_with(wallet, CUSDCV3_TESTNET_ADDRESS)
        mock_get_health.assert_called_once_with(wallet, CUSDCV3_TESTNET_ADDRESS)

        # Check output for indicating absence of supply and borrow details.
        assert "No supplied assets found in your Compound position." in result
        assert "No borrowed assets found in your Compound position." in result

        # Since there are no supplied assets, the total supply value should be $0.00.
        assert "### Total Supply Value: $0.00" in result

        # Verify that the overall health ratio is correctly formatted.
        assert "## Overall Health" in result
        assert "- **Health Ratio:** 5.00" in result

def test_get_portfolio_details_multiple_assets_supplied(wallet_factory, asset_factory):
    """Test get_portfolio_details function for a wallet on mainnet with multiple supplied assets."""
    # Use wallet_factory instead of direct Mock creation
    wallet = wallet_factory(network_id="base-mainnet")

    # Setup multiple supply details for two assets: WETH and CBETH
    supply_details = [
        {
            "Token Symbol": "weth",
            "Supply Amount": 2,
            "Price": 2000.00,
            "Collateral Factor": 0.75,
        },
        {
            "Token Symbol": "cbeth",
            "Supply Amount": 3,
            "Price": 1500.00,
            "Collateral Factor": 0.80,
        },
    ]
    borrow_details = {
        "Token Symbol": "usdc",
        "Borrow Amount": 3300.00,
        "Price": 1.00,
    }
    health_ratio = 2.0

    # Create a side effect function that returns different assets based on asset_id
    def asset_fetch_side_effect(network_id, asset_id):
        return asset_factory(network_id=network_id, asset_id=asset_id, decimals=18)

    with patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_supply_details",
        return_value=supply_details,
    ) as mock_get_supply, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_borrow_details",
        return_value=borrow_details,
    ) as mock_get_borrow, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_health_ratio",
        return_value=health_ratio,
    ) as mock_get_health, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.Asset.fetch",
        side_effect=asset_fetch_side_effect,
    ) as mock_asset_fetch:
        result = get_portfolio_details(wallet)

        # Verify that the utility functions are called with the correct compound address
        mock_get_supply.assert_called_once_with(wallet, CUSDCV3_MAINNET_ADDRESS)
        mock_get_borrow.assert_called_once_with(wallet, CUSDCV3_MAINNET_ADDRESS)
        mock_get_health.assert_called_once_with(wallet, CUSDCV3_MAINNET_ADDRESS)

        # Verify Asset.fetch was called for each supplied asset
        mock_asset_fetch.assert_any_call(wallet.network_id, "weth")
        mock_asset_fetch.assert_any_call(wallet.network_id, "cbeth")
        assert mock_asset_fetch.call_count == 2  # Called exactly twice

        # Verify supply details for WETH
        assert "### weth" in result
        assert "- **Supply Amount:** 2.000000000000000000" in result  # Note: 18 decimals
        assert "- **Price:** $2000.00" in result
        assert "- **Collateral Factor:** 0.75" in result
        assert "- **Asset Value:** $4000.00" in result

        # Verify supply details for CBETH
        assert "### cbeth" in result
        assert "- **Supply Amount:** 3.000000000000000000" in result  # Note: 18 decimals
        assert "- **Price:** $1500.00" in result
        assert "- **Collateral Factor:** 0.80" in result
        assert "- **Asset Value:** $4500.00" in result

        # Total Supply Value assertion: 4000 + 4500 = 8500.00
        assert "### Total Supply Value: $8500.00" in result

        # Borrow details assertions
        assert "- **Borrow Amount:** 3300.000000" in result
        assert "- **Price:** $1.00" in result
        assert "- **Borrow Value:** $3300.00" in result

        # Overall health section verification
        assert "## Overall Health" in result
        assert "- **Health Ratio:** 2.00" in result

def test_get_portfolio_details_exception(wallet_factory):
    """Test that get_portfolio_details properly handles exceptions raised by dependencies."""
    wallet = wallet_factory(network_id="base-mainnet")
    with patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_supply_details",
        side_effect=Exception("API error")
    ) as mock_get_supply:
        result = get_portfolio_details(wallet)
        # Ensure the error message includes the exception text.
        assert result == "Error retrieving portfolio details from Compound: API error"
        mock_get_supply.assert_called_once_with(wallet, CUSDCV3_MAINNET_ADDRESS)

def test_get_portfolio_details_asset_not_found(wallet_factory):
    """Test that get_portfolio_details properly handles ApiError when an asset is not found."""
    wallet = wallet_factory(network_id="base-sepolia")

    # Mock supply details with an asset that will trigger the ApiError.
    supply_details = [{
        "Token Symbol": "unknown_token",
        "Supply Amount": 100,
        "Price": 1.00,
        "Collateral Factor": 0.75,
    }]

    # Mock minimal borrow details.
    borrow_details = {
        "Token Symbol": "usdc",
        "Borrow Amount": 0,
        "Price": 1.00,
    }

    # Create a proper ApiError instance using Option 1.
    api_exception = ApiException("404", "asset 'unknown_token' not found", None)
    api_error = ApiError(api_exception, message="asset 'unknown_token' not found")

    with patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_supply_details",
        return_value=supply_details
    ) as mock_get_supply, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_borrow_details",
        return_value=borrow_details
    ) as mock_get_borrow, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.get_health_ratio",
        return_value=float('inf')
    ) as mock_get_health, patch(
        "cdp_agentkit_core.actions.compound.portfolio_details.Asset.fetch",
        side_effect=api_error
    ) as mock_asset_fetch:

        result = get_portfolio_details(wallet)

        # Verify the function calls.
        mock_get_supply.assert_called_once_with(wallet, CUSDCV3_TESTNET_ADDRESS)
        mock_get_borrow.assert_called_once_with(wallet, CUSDCV3_TESTNET_ADDRESS)
        mock_get_health.assert_called_once_with(wallet, CUSDCV3_TESTNET_ADDRESS)
        mock_asset_fetch.assert_called_once_with(wallet.network_id, "unknown_token")

        # Verify that the function continues execution and includes expected sections.
        assert "# Portfolio Details" in result
        assert "### Total Supply Value: $0.00" in result  # Should be 0 since asset was skipped.
        assert "## Borrow Details" in result
        assert "No borrowed assets found in your Compound position." in result
        assert "## Overall Health" in result
        assert "- **Health Ratio:** inf" in result
