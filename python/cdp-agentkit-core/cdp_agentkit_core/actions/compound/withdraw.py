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
from cdp_agentkit_core.actions.compound.utils import (
    get_collateral_balance,
    get_health_ratio_after_withdraw,
)

# Constants
COMPOUND_WITHDRAW_PROMPT = """
This tool allows you to withdraw ETH or USDC from Compound V3 markets on Base.

It takes the following inputs:
- asset_id: The asset to withdraw, either `eth` or `usdc`
- amount: The amount of assets to withdraw in whole units
    Examples for WETH:
    - 1 WETH
    - 0.1 WETH
    - 0.01 WETH

Important notes:
- Ensure you have sufficient supplied balance of the asset you want to withdraw
- For any withdrawal, make sure to have some ETH for gas fees
"""


class CompoundWithdrawInput(BaseModel):
    """Input argument schema for withdrawing assets from a Compound market."""

    asset_id: Literal["weth", "cbeth", "cbbtc", "wsteth", "usdc"] = Field(
        ...,
        description="The asset ID to withdraw from the Compound market, one of `weth`, `cbeth`, `cbbtc`, `wsteth`, or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to withdraw from the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


def compound_withdraw(wallet: Wallet, asset_id: Literal["weth", "cbeth", "cbbtc", "wsteth", "usdc"], amount: str) -> str:
    """Withdraw assets from a Compound market.

    Args:
        wallet (Wallet): The wallet to withdraw the assets to.
        asset_id (Literal['weth', 'cbeth', 'cbbtc', 'wsteth', 'usdc']): The asset ID to withdraw from the Compound market.
        amount (str): The amount of the asset to withdraw from the Compound market.

    Returns:
        str: A message containing the withdrawal details.

    """
    # Get the asset details
    asset = Asset.fetch(wallet.network_id, asset_id)
    adjusted_amount = str(int(asset.to_atomic_amount(Decimal(amount))))

    # Determine which Compound market to use based on network
    is_mainnet = wallet.network_id == "base-mainnet"
    compound_address = CUSDCV3_MAINNET_ADDRESS if is_mainnet else CUSDCV3_TESTNET_ADDRESS

    # Check that there is enough balance supplied to withdraw amount
    collateral_balance = get_collateral_balance(wallet, compound_address, asset.contract_address)
    if int(adjusted_amount) > collateral_balance:
        return f"Error: Insufficient balance. Trying to withdraw {amount} {asset_id.upper()}, but only have {asset.from_atomic_amount(collateral_balance)} {asset_id.upper()} supplied"

    # Check if position would be healthy after withdrawal
    projected_health_ratio = get_health_ratio_after_withdraw(
        wallet,
        compound_address,
        asset.contract_address,
        adjusted_amount
    )

    if projected_health_ratio < 1:
        return f"Error: Withdrawing {amount} {asset_id.upper()} would result in an unhealthy position. Health ratio would be {projected_health_ratio:.2f}"

    try:
        # Withdraw from Compound
        withdraw_result = wallet.invoke_contract(
            contract_address=compound_address,
            method="withdraw",
            args={
                "asset": asset.contract_address,
                "amount": adjusted_amount
            },
            abi=CUSDCV3_ABI,
        ).wait()

        return f"Withdrew {amount} {asset_id.upper()} from Compound V3.\nTransaction hash: {withdraw_result.transaction_hash}\nTransaction link: {withdraw_result.transaction_link}"

    except Exception as e:
        return f"Error withdrawing {amount} {asset_id.upper()} from Compound: {e!s}"


class CompoundWithdrawAction(CdpAction):
    """Compound withdraw action."""

    name: str = "compound_withdraw"
    description: str = COMPOUND_WITHDRAW_PROMPT
    args_schema: type[BaseModel] | None = CompoundWithdrawInput
    func: Callable[..., str] = compound_withdraw
