from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.superfluid.constants import (
    CREATE_ABI,
)

SUPERFLUID_CREATE_FLOW_PROMPT = """
This tool will create a money flow to a specified token recipient using Superfluid. Do not use this tool for any other purpose, or trading other assets.

Inputs:
- Wallet address to send the tokens to
- Super token contract address
- The flowrate of flow in wei per second

Important notes:
- The flowrate cannot have any decimal points, since the unit of measurement is wei per second.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 ETH
"""


class SuperfluidCreateFlowInput(BaseModel):
    """Input argument schema for creating a flow."""

    recipient: str = Field(..., description="The wallet address of the recipient")

    token_address: str = Field(..., description="The address of the token that will be streamed")

    flow_rate: str = Field(..., description="The flow rate of tokens in wei per second")


def superfluid_create_flow(
    wallet: Wallet, recipient: str, token_address: str, flow_rate: str
) -> str:
    """Create a money flow using Superfluid.

    Args:
        wallet (Wallet): The wallet initiating the flow.
        recipient (str): Recipient's wallet address.
        token_address (str): Address of the token that will be streamed.
        flow_rate (str): Rate of token flow in wei per second.

    Returns:
        str: Confirmation of flow creation.

    """
    try:
        invocation = wallet.invoke_contract(
            contract_address="0xcfA132E353cB4E398080B9700609bb008eceB125",
            abi=CREATE_ABI,
            method="createFlow",
            args={
                "token": token_address,
                "sender": wallet.default_address.address_id,
                "receiver": recipient,
                "flowrate": flow_rate,
                "userData": "0x",
            },
        )

        invocation.wait()

        return f"Flow created successfully. Result: {invocation}"

    except Exception as e:
        return f"Error creating flow: {e!s}"


class SuperfluidCreateFlowAction(CdpAction):
    """Create flow action."""

    name: str = "superfluid_create_flow"
    description: str = SUPERFLUID_CREATE_FLOW_PROMPT
    args_schema: type[BaseModel] | None = SuperfluidCreateFlowInput
    func: Callable[..., str] = superfluid_create_flow
