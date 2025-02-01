from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel

from cdp_agentkit_core.actions import CdpAction


class GetWalletDetailsInput(BaseModel):
    """Input argument schema for get wallet details action."""


def get_wallet_details(wallet: Wallet) -> str:
    """Get a wallet's details.

    Args:
        wallet (Wallet): The wallet to trade the asset from.

    Returns:
        str: A message containing the wallet details.

    """
    return f"Wallet: {wallet.id} on network: {wallet.network_id} with default address: {wallet.default_address.address_id}"


class GetWalletDetailsAction(CdpAction):
    """Get wallet details action."""

    name: str = "get_wallet_details"
    description: str = "This tool will get details about the MPC Wallet."
    args_schema: type[BaseModel] | None = GetWalletDetailsInput
    func: Callable[..., str] = get_wallet_details
