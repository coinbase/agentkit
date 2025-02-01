from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

REQUEST_FAUCET_FUNDS_PROMPT = """
This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
If no asset ID is provided the faucet defaults to ETH. Faucet is only allowed on 'base-sepolia' and can only provide asset ID 'eth' or 'usdc'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.
"""


class RequestFaucetFundsInput(BaseModel):
    """Input argument schema for request faucet funds action."""

    asset_id: str | None = Field(
        default=None,
        description="The optional asset ID to request from faucet. Accepts `eth` or `usdc`. When omitted, defaults to the network's native asset.",
    )


def request_faucet_funds(wallet: Wallet, asset_id: str | None = None) -> str:
    """Request test tokens from the faucet for the default address in the wallet.

    Args:
        wallet (Wallet): The wallet to receive tokens
        asset_id (str | None): The optional asset ID to request from the faucet. Accepts "eth" or "usdc". When omitted, defaults to the network's native asset.

    Returns:
        str: Confirmation message with transaction details

    """
    try:
        # Request funds from the faucet.
        faucet_tx = wallet.faucet(asset_id=asset_id if asset_id else None)

        # Wait for the faucet transaction to be confirmed.
        faucet_tx.wait()
    except Exception as e:
        return f"Error requesting faucet funds {e!s}"

    return f"Received {asset_id} from the faucet. Transaction: {faucet_tx.transaction_link}"


class RequestFaucetFundsAction(CdpAction):
    """Request faucet funds action."""

    name: str = "request_faucet_funds"
    description: str = REQUEST_FAUCET_FUNDS_PROMPT
    args_schema: type[BaseModel] | None = RequestFaucetFundsInput
    func: Callable[..., str] = request_faucet_funds
