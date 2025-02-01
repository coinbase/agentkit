from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.morpho.constants import METAMORPHO_ABI


class MorphoWithdrawInput(BaseModel):
    """Input schema for Morpho Vault withdraw action."""

    vault_address: str = Field(..., description="The address of the Morpho Vault to withdraw from")
    assets: str = Field(..., description="The amount of assets to withdraw in atomic units")
    receiver: str = Field(..., description="The address to receive the withdrawn assets")


WITHDRAW_PROMPT = """
This tool allows withdrawing assets from a Morpho Vault. It takes:

- vault_address: The address of the Morpho Vault to withdraw from
- assets: The amount of assets to withdraw in atomic units
- receiver: The address to receive the shares
"""


def withdraw_from_morpho(wallet: Wallet, vault_address: str, assets: str, receiver: str) -> str:
    """Withdraw assets from a Morpho Vault.

    Args:
        wallet (Wallet): The wallet to execute the deposit from
        vault_address (str): The address of the Morpho Vault
        assets (str): The amount of assets to withdraw in atomic units
        receiver (str): The address to receive the shares

    Returns:
        str: A success message with transaction hash or error message

    """
    if int(assets) <= 0:
        return "Error: Assets amount must be greater than 0"

    try:
        invocation = wallet.invoke_contract(
            contract_address=vault_address,
            method="withdraw",
            abi=METAMORPHO_ABI,
            args={
                "assets": assets,
                "receiver": receiver,
                "owner": receiver,
            },
        ).wait()

        return f"Withdrawn {assets} from Morpho Vault {vault_address} with transaction hash: {invocation.transaction_hash} and transaction link: {invocation.transaction_link}"

    except Exception as e:
        return f"Error withdrawing from Morpho Vault: {e!s}"


class MorphoWithdrawAction(CdpAction):
    """Morpho Vault withdraw action."""

    name: str = "morpho_withdraw"
    description: str = WITHDRAW_PROMPT
    args_schema: type[BaseModel] = MorphoWithdrawInput
    func: Callable[..., str] = withdraw_from_morpho
