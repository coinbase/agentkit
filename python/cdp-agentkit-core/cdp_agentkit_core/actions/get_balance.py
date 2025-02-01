from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

GET_BALANCE_PROMPT = """
This tool will get the balance of all the addresses in the wallet for a given asset.
It takes the asset ID as input. Always use 'eth' for the native asset ETH and 'usdc' for USDC.
"""


class GetBalanceInput(BaseModel):
    """Input argument schema for get balance action."""

    asset_id: str = Field(
        ...,
        description="The asset ID to get the balance for, e.g. `eth`, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )


def get_balance(wallet: Wallet, asset_id: str) -> str:
    """Get balance for all addresses in the wallet for a given asset.

    Args:
        wallet (Wallet): The wallet to get the balance for.
        asset_id (str): The asset ID to get the balance for (e.g., "eth", "usdc", or a valid contract address like "0x036CbD53842c5426634e7929541eC2318f3dCF7e")

    Returns:
        str: A message containing the balance information of all addresses in the wallet.

    """
    # for each address in the wallet, get the balance for the asset
    balances = {}

    try:
        for address in wallet.addresses:
            balance = address.balance(asset_id)
            balances[address.address_id] = balance
    except Exception as e:
        return f"Error getting balance for all addresses in the wallet {e!s}"

    # Format each balance entry on a new line
    balance_lines = [f"  {addr}: {balance}" for addr, balance in balances.items()]
    formatted_balances = "\n".join(balance_lines)
    return f"Balances for wallet {wallet.id}:\n{formatted_balances}"


class GetBalanceAction(CdpAction):
    """Get wallet balance action."""

    name: str = "get_balance"
    description: str = GET_BALANCE_PROMPT
    args_schema: type[BaseModel] | None = GetBalanceInput
    func: Callable[..., str] = get_balance
