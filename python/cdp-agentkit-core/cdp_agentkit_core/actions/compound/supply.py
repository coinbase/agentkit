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
COMPOUND_SUPPLY_PROMPT = """
This tool allows you to supply ETH or USDC to Compound V3 markets on Base.

It takes the following inputs:
- asset_id: The asset to supply, either `eth` or `usdc`
- amount: The amount of assets to supply in whole units
    Examples for WETH:
    - 1 WETH
    - 0.1 WETH
    - 0.01 WETH

Important notes:
- Ensure you have sufficient balance of the asset you want to supply
- For ETH supply, make sure to have extra ETH for gas fees
"""


class CompoundSupplyInput(BaseModel):
    """Input argument schema for supplying assets to a Compound market."""

    asset_id: Literal["weth", "cbeth", "cbbtc", "wsteth", "usdc"] = Field(
        ...,
        description="The asset ID to supply to the Compound market, one of `weth`, `cbeth`, `cbbtc`, `wsteth`, or `usdc`",
    )
    amount: str = Field(
        ...,
        description="The amount of the asset to supply to the Compound market, e.g. 0.125 weth; 19.99 usdc",
    )


def compound_supply(wallet: Wallet, asset_id: Literal["weth", "cbeth", "cbbtc", "wsteth", "usdc"], amount: str) -> str:
    """Supply assets to a Compound market.

    Args:
        wallet (Wallet): The wallet to supply the assets from.
        asset_id (Literal['weth', 'cbeth', 'cbbtc', 'wsteth', 'usdc']): The asset ID to supply to the Compound market.
        amount (str): The amount of the asset to supply to the Compound market.

    Returns:
        str: A message containing the supply details.

    """
    # Check wallet balance before proceeding
    wallet_balance = wallet.default_address.balance(asset_id)
    if Decimal(wallet_balance) < Decimal(amount):
        return f"Error: Insufficient balance. You have {wallet_balance} {asset_id.upper()}, but trying to supply {amount} {asset_id.upper()}"

    # Get the asset details
    asset = Asset.fetch(wallet.network_id, asset_id)
    adjusted_amount = str(int(asset.to_atomic_amount(Decimal(amount))))

    # Determine which Compound market to use based on network
    is_mainnet = wallet.network_id == "base-mainnet"
    compound_address = CUSDCV3_MAINNET_ADDRESS if is_mainnet else CUSDCV3_TESTNET_ADDRESS

    try:
        # Always approve the asset
        approval_result = approve(wallet, asset.contract_address, compound_address, adjusted_amount)
        if approval_result.startswith("Error"):
            return f"Error approving Compound as spender: {approval_result}"

        # Supply to Compound
        supply_result = wallet.invoke_contract(
            contract_address=compound_address,
            method="supply",
            args={
                "asset": asset.contract_address,
                "amount": adjusted_amount
            },
            abi=CUSDCV3_ABI,
        ).wait()

        return f"Supplied {amount} {asset_id.upper()} to Compound V3.\nTransaction hash: {supply_result.transaction_hash}\nTransaction link: {supply_result.transaction_link}"

    except Exception as e:
        return f"Error supplying {amount} {asset_id.upper()} to Compound: {e!s}"


class CompoundSupplyAction(CdpAction):
    """Compound supply action."""

    name: str = "compound_supply"
    description: str = COMPOUND_SUPPLY_PROMPT
    args_schema: type[BaseModel] | None = CompoundSupplyInput
    func: Callable[..., str] = compound_supply






