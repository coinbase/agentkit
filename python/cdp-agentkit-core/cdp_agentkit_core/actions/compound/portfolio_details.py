from collections.abc import Callable

from cdp import Asset, Wallet
from cdp.errors import ApiError
from pydantic import BaseModel

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.compound.constants import (
    CUSDCV3_MAINNET_ADDRESS,
    CUSDCV3_TESTNET_ADDRESS,
)
from cdp_agentkit_core.actions.compound.utils import (
    get_borrow_details,
    get_health_ratio,
    get_supply_details,
)


class PortfolioDetailsInput(BaseModel):
    """Input argument schema for fetching portfolio details.

    No additional input is required.
    """

    pass

def get_portfolio_details(wallet: Wallet) -> str:
    """Retrieve portfolio details, including supply, borrow, and health information, for a Compound position.

    This function assumes that the supply and borrow details returned by utility functions
    are already given in human-readable units (e.g. 100 USDC means 100, rather than 1e8).
    The collateral factor is also expected to be in fraction form (e.g. 0.75 means 75%).

    Args:
        wallet (Wallet): The wallet instance for which to fetch portfolio details.

    Returns:
        str: A markdown formatted string with portfolio details, including supply details,
             borrow details, and overall health.

    """
    try:
        # Determine the Compound market address based on network.
        compound_address = (
            CUSDCV3_MAINNET_ADDRESS
            if wallet.network_id == "base-mainnet"
            else CUSDCV3_TESTNET_ADDRESS
        )

        # Retrieve position details (already in human-readable form).
        supply_details = get_supply_details(wallet, compound_address)
        borrow_details = get_borrow_details(wallet, compound_address)
        health_ratio = get_health_ratio(wallet, compound_address)

        # Prepare the response as markdown for readability.
        markdown_output = "# Portfolio Details\n\n"

        # Supply Details Section
        markdown_output += "## Supply Details\n\n"
        total_supply_value = 0.0
        if supply_details:
            for supply in supply_details:
                token = supply["Token Symbol"] # NOTE: Token is the asset_id at this point, lowercased.
                try:
                    asset = Asset.fetch(wallet.network_id, token.lower())
                # NOTE: The Comet's assets list may contain assets that are not found in the CDP API, so we skip them.
                # This is currently only an issue on testnet since all assets are supported on mainnet. There's
                # an open issue to have Coinbase list more assets on Testnet. Compound has a cbETH in its testnet.
                except ApiError as e:
                    if int(e.http_code) == 404:
                        continue

                decimals = 6 if not hasattr(asset, 'decimals') else asset.decimals

                human_supply_amount = supply["Supply Amount"]
                asset_value = human_supply_amount * supply["Price"]
                human_collateral_factor = supply["Collateral Factor"]

                markdown_output += f"### {token}\n"
                # Get decimals for proper formatting

                markdown_output += f"- **Supply Amount:** {format(human_supply_amount, f'.{decimals}f')}\n"
                markdown_output += f"- **Price:** ${supply['Price']:.2f}\n"
                markdown_output += f"- **Collateral Factor:** {human_collateral_factor:.2f}\n"
                markdown_output += f"- **Asset Value:** ${asset_value:.2f}\n\n"
                total_supply_value += asset_value
        else:
            markdown_output += "No supplied assets found in your Compound position.\n\n"

        # Add total supply value to the output.
        markdown_output += f"### Total Supply Value: ${total_supply_value:.2f}\n\n"

        # Borrow Details Section
        markdown_output += "## Borrow Details\n\n"
        if borrow_details and borrow_details.get("Borrow Amount", 0) > 0:
            token = borrow_details["Token Symbol"]
            human_borrow_amount = borrow_details["Borrow Amount"]
            borrow_value = human_borrow_amount * borrow_details["Price"]

            markdown_output += f"### {token}\n"
            markdown_output += f"- **Borrow Amount:** {human_borrow_amount:.6f}\n"
            markdown_output += f"- **Price:** ${borrow_details['Price']:.2f}\n"
            markdown_output += f"- **Borrow Value:** ${borrow_value:.2f}\n\n"
        else:
            markdown_output += "No borrowed assets found in your Compound position.\n\n"

        # Overall Health Section
        markdown_output += "## Overall Health\n\n"
        markdown_output += f"- **Health Ratio:** {health_ratio:.2f}\n"

        return markdown_output

    except Exception as e:
        return f"Error retrieving portfolio details from Compound: {e!s}"

class CompoundPortfolioDetailsAction(CdpAction):
    """Action to retrieve portfolio details including supply details, borrow details, and overall health."""

    name: str = "get_portfolio_details"
    description: str = (
        "Fetches supply, borrow, and overall health details of your Compound position, "
        "formatted in Markdown for ease of readability."
    )
    args_schema: type[BaseModel] | None = PortfolioDetailsInput
    func: Callable[..., str] = get_portfolio_details
