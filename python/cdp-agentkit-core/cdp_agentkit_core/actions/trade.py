from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

TRADE_PROMPT = """
This tool will trade a specified amount of a 'from asset' to a 'to asset' for the wallet.

It takes the following inputs:
- The amount of the 'from asset' to trade
- The from asset ID to trade
- The asset ID to receive from the trade

Important notes:
- Trades are only supported on mainnet networks (ie, 'base-mainnet', 'base', 'ethereum-mainnet', 'ethereum', etc.)
- Never allow trades on any non-mainnet network (ie, 'base-sepolia', 'ethereum-sepolia', etc.)
- When selling a native asset (e.g. 'eth' on base-mainnet), ensure there is sufficient balance to pay for the trade AND the gas cost of this trade
"""


class TradeInput(BaseModel):
    """Input argument schema for trade action."""

    amount: str = Field(
        ..., description="The amount of the from asset to trade, e.g. `15`, `0.000001`"
    )
    from_asset_id: str = Field(
        ...,
        description="The from asset ID to trade, e.g. `eth`, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )
    to_asset_id: str = Field(
        ...,
        description="The to asset ID to receive from the trade, e.g. `eth`, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )


def trade(wallet: Wallet, amount: str, from_asset_id: str, to_asset_id: str) -> str:
    """Trade a specified amount of a from asset to a to asset for the wallet. Trades are only supported on Mainnets.

    Args:
        wallet (Wallet): The wallet to trade the asset from.
        amount (str): The amount of the from asset to trade, e.g. `15`, `0.000001`.
        from_asset_id (str): The from asset ID to trade (e.g., "eth", "usdc", or a valid contract address like "0x036CbD53842c5426634e7929541eC2318f3dCF7e").
        to_asset_id (str): The from asset ID to trade (e.g., "eth", "usdc", or a valid contract address like "0x036CbD53842c5426634e7929541eC2318f3dCF7e").

    Returns:
        str: A message containing the trade details.

    """
    try:
        trade_result = wallet.trade(
            amount=amount, from_asset_id=from_asset_id, to_asset_id=to_asset_id
        ).wait()
    except Exception as e:
        return f"Error trading assets {e!s}"

    return f"Traded {amount} of {from_asset_id} for {trade_result.to_amount} of {to_asset_id}.\nTransaction hash for the trade: {trade_result.transaction.transaction_hash}\nTransaction link for the trade: {trade_result.transaction.transaction_link}"


class TradeAction(CdpAction):
    """Trade action."""

    name: str = "trade"
    description: str = TRADE_PROMPT
    args_schema: type[BaseModel] | None = TradeInput
    func: Callable[..., str] = trade
