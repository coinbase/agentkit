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
from cdp_agentkit_core.actions.utils import approve

# Constants
COMPOUND_REPAY_PROMPT = """
This tool allows you to repay borrowed WETH or USDC to Compound V3 markets on Base.

It takes the following inputs:
- asset_id: The asset to repay, either `weth` or `usdc`
- amount: The amount of assets to repay in whole units
    Examples for WETH:
    - 1 WETH
    - 0.1 WETH
    - 0.01 WETH

Important notes:
- Ensure you have sufficient balance of the asset you want to repay
- For any repayment, make sure to have some ETH for gas fees
- Repaying reduces your borrow position and accrued interest
"""


class CompoundRepayInput(BaseModel):
    """Input argument schema for repaying assets to a Compound market."""

    asset_id: Literal["weth", "usdc"] = Field(
        ...,
        description="The asset ID to repay to the Compound market, either `weth` or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to repay to the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


def compound_repay(wallet: Wallet, asset_id: Literal["weth", "usdc"], amount: str) -> str:
    """Repay borrowed assets to a Compound market.

    Args:
        wallet (Wallet): The wallet to repay the assets from.
        asset_id (Literal['weth', 'usdc']): The asset ID to repay to the Compound market.
        amount (str): The amount of the asset to repay to the Compound market.

    Returns:
        str: A message containing the repayment details.

    """
    # Check wallet balance before proceeding
    wallet_balance = wallet.default_address.balance(asset_id)
    if Decimal(wallet_balance) < Decimal(amount):
        return f"Error: Insufficient balance. You have {wallet_balance} {asset_id.upper()}, but trying to repay {amount} {asset_id.upper()}"

    # Get the asset details
    asset = Asset.fetch(wallet.network_id, asset_id)
    adjusted_amount = str(int(asset.to_atomic_amount(Decimal(amount))))

    # Determine which Compound market to use based on network
    is_mainnet = wallet.network_id == "base-mainnet"
    compound_address = CUSDCV3_MAINNET_ADDRESS if is_mainnet else CUSDCV3_TESTNET_ADDRESS

    try:
        # Always approve the asset first
        approval_result = approve(wallet, asset.contract_address, compound_address, adjusted_amount)
        if approval_result.startswith("Error"):
            return f"Error approving Compound as spender: {approval_result}"

        # Use supply method to repay to Compound
        repay_result = wallet.invoke_contract(
            contract_address=compound_address,
            method="supply",
            args={
                "asset": asset.contract_address,
                "amount": adjusted_amount
            },
            abi=CUSDCV3_ABI,
        ).wait()

        return f"Repaid {amount} {asset_id.upper()} to Compound V3.\nTransaction hash: {repay_result.transaction_hash}\nTransaction link: {repay_result.transaction_link}"

    except Exception as e:
        return f"Error repaying {amount} {asset_id.upper()} to Compound: {e!s}"


class CompoundRepayAction(CdpAction):
    """Compound repay action."""

    name: str = "compound_repay"
    description: str = COMPOUND_REPAY_PROMPT
    args_schema: type[BaseModel] | None = CompoundRepayInput
    func: Callable[..., str] = compound_repay
