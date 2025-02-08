from collections.abc import Callable
from decimal import Decimal
from typing import Literal

from cdp import Asset, Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.compound.constants import (
    CUSDCV3_ABI,
    CUSDCV3_MAINNET_ADDRESS,
    CUSDCV3_TESTNET_ADDRESS,
)
from cdp_agentkit_core.actions.compound.utils import get_health_ratio_after_borrow

# Constants
COMPOUND_BORROW_PROMPT = """
This tool allows you to borrow WETH or USDC from Compound V3 markets on Base.

It takes the following inputs:
- asset_id: The asset to borrow, either `weth` or `usdc`
- amount: The amount of assets to borrow in whole units
    Examples for WETH:
    - 1 WETH
    - 0.1 WETH
    - 0.01 WETH

Important notes:
- Ensure you have sufficient collateral to borrow against
- For any borrowing, make sure to have some ETH for gas fees
- Be aware of your borrowing capacity and liquidation risks
"""


class CompoundBorrowInput(BaseModel):
    """Input argument schema for borrowing assets from a Compound market."""

    asset_id: Literal["weth", "usdc"] = Field(
        ...,
        description="The asset ID to borrow from the Compound market, either `weth` or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to borrow from the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


def compound_borrow(wallet: Wallet, asset_id: Literal["weth", "usdc"], amount: str) -> str:
    """Borrow assets from a Compound market.

    Args:
        wallet (Wallet): The wallet to receive the borrowed assets.
        asset_id (Literal['weth', 'usdc']): The asset ID to borrow from the Compound market.
        amount (str): The amount of the asset to borrow from the Compound market.

    Returns:
        str: A message containing the borrowing details.

    """
    # Get the asset details
    asset = Asset.fetch(wallet.network_id, asset_id)
    adjusted_amount = str(int(asset.to_atomic_amount(Decimal(amount))))

    # Determine which Compound market to use based on network
    is_mainnet = wallet.network_id == "base-mainnet"
    compound_address = CUSDCV3_MAINNET_ADDRESS if is_mainnet else CUSDCV3_TESTNET_ADDRESS

    # Check if position would be healthy after borrow
    projected_health_ratio = get_health_ratio_after_borrow(
        wallet,
        compound_address,
        adjusted_amount
    )

    if projected_health_ratio < 1:
        return f"Error: Borrowing {amount} {asset_id.upper()} would result in an unhealthy position. Health ratio would be {projected_health_ratio:.2f}"

    try:
        # Use withdraw method to borrow from Compound
        borrow_result = wallet.invoke_contract(
            contract_address=compound_address,
            method="withdraw",
            args={
                "asset": asset.contract_address,
                "amount": adjusted_amount
            },
            abi=CUSDCV3_ABI,
        ).wait()

        return f"Borrowed {amount} {asset_id.upper()} from Compound V3.\nTransaction hash: {borrow_result.transaction_hash}\nTransaction link: {borrow_result.transaction_link}"

    except Exception as e:
        return f"Error borrowing {amount} {asset_id.upper()} from Compound: {e!s}"


class CompoundBorrowAction(CdpAction):
    """Compound borrow action."""

    name: str = "compound_borrow"
    description: str = COMPOUND_BORROW_PROMPT
    args_schema: type[BaseModel] | None = CompoundBorrowInput
    func: Callable[..., str] = compound_borrow
