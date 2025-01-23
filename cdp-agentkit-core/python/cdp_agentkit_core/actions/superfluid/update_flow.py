from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.superfluid.constants import (
    UPDATE_ABI,
)

SUPERFLUID_UPDATE_FLOW_PROMPT = """
This tool will update an existing money flow to a specified token recipient using Superfluid. Do not use this tool for any other purpose, or trading other assets.

Inputs:
- Wallet address that the tokens are being streamed to
- Super token contract address
- The new flowrate of flow in wei per second

Important notes:
- The flowrate cannot have any decimal points, since the unit of measurement is wei per second.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 ETH
"""


class SuperfluidUpdateFlowInput(BaseModel):
    """Input argument schema for updating a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")

    token_address: str = Field(..., description="The address of the token that is being streamed")

    new_flow_rate: str = Field(..., description="The new flow rate of tokens in wei per second")


def superfluid_update_flow(
    wallet: Wallet, recipient: str, token_address: str, new_flow_rate: str
) -> str:
    """Update an existing money flow using Superfluid.

    Args:
        wallet (Wallet): The wallet initiating the update.
        recipient (str): Recipient's wallet address.
        token_address (str): Address of the token that is being streamed.
        new_flow_rate (str): New rate of token flow in wei per second.

    Returns:
        str: Confirmation of flow update.

    """
    try:
        invocation = wallet.invoke_contract(
            contract_address="0xcfA132E353cB4E398080B9700609bb008eceB125",
            abi=UPDATE_ABI,
            method="updateFlow",
            args={
                "token": token_address,
                "sender": wallet.default_address.address_id,
                "receiver": recipient,
                "flowrate": new_flow_rate,
                "userData": "0x",
            },
        )

        invocation.wait()

        return f"Flow updated successfully. Result: {invocation}"

    except Exception as e:
        return f"Error updating flow: {e!s}"


class SuperfluidUpdateFlowAction(CdpAction):
    """Update flow action."""

    name: str = "superfluid_update_flow"
    description: str = SUPERFLUID_UPDATE_FLOW_PROMPT
    args_schema: type[BaseModel] | None = SuperfluidUpdateFlowInput
    func: Callable[..., str] = superfluid_update_flow
