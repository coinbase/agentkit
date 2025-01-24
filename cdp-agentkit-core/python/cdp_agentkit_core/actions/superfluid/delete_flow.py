from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.superfluid.constants import (
    DELETE_ABI,
)

SUPERFLUID_DELETE_FLOW_PROMPT = """
This tool will delete an existing money flow to a token recipient using Superfluid. Do not use this tool for any other purpose, or trading other assets.

Inputs:
- Wallet address that the tokens are being streamed to or being streamed from
- Super token contract address
"""


class SuperfluidDeleteFlowInput(BaseModel):
    """Input argument schema for deleting a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")

    token_address: str = Field(..., description="The address of the token being flowed")


def superfluid_delete_flow(wallet: Wallet, recipient: str, token_address: str) -> str:
    """Delete an existing money flow using Superfluid.

    Args:
        wallet (Wallet): The wallet closing the flow.
        recipient (str): Recipient's wallet address.
        token_address (str): Address of the token being streamed.

    Returns:
        str: Confirmation of flow closure.

    """
    try:
        invocation = wallet.invoke_contract(
            contract_address="0xcfA132E353cB4E398080B9700609bb008eceB125",
            abi=DELETE_ABI,
            method="deleteFlow",
            args={
                "token": token_address,
                "sender": wallet.default_address.address_id,
                "receiver": recipient,
                "userData": "0x",
            },
        )

        invocation.wait()

        return f"Flow deleted successfully. Result: {invocation}"
    except Exception as e:
        return f"Error deleting flow: {e!s}"


class SuperfluidDeleteFlowAction(CdpAction):
    """Delete flow action."""

    name: str = "superfluid_delete_flow"
    description: str = SUPERFLUID_DELETE_FLOW_PROMPT
    args_schema: type[BaseModel] | None = SuperfluidDeleteFlowInput
    func: Callable[..., str] = superfluid_delete_flow
