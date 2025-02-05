from langchain.tools import BaseTool
from typing import Optional, Type
from pydantic import BaseModel, Field
from collections.abc import Callable
import json

from cdp import Wallet
from cdp_agentkit_core.actions import CdpAction

from .get_abi import get_abi

INVOKE_CONTRACT_PROMPT = """
This tool will invoke a function in a contract.
Example usage: {"address": "0x1234...5678", "method": "functionName", "parameters": "{\"to\": \"0x1234...5678\", \"value\": \"100...000\"}", "value": "1000000000000000000"}
"""

class InvokeContractInput(BaseModel):
    """Input argument schema for invoke contract action."""

    address: str = Field(..., description="Address of the contract to invoke, e.g., '0x1234...5678'")
    method: str = Field(..., description="Method signature to invoke, e.g., 'functionName'")
    parameters: str = Field(..., description='Arguments for the function, e.g., "{\"to\": \"0x1234...5678\", \"value\": \"100...000\"}", it should be nested JSON')
    value: str = Field(..., description="Value to send with the invocation, in wei")

def invoke_contract(wallet: Wallet, address: str, method: str, parameters: str, value: str) -> str:
    """Invoke a function in a contract.

    Args:
        wallet (Wallet): The wallet to invoke the contract with.
        address (str): The address of the contract to invoke.
        method (str): The method signature to invoke.
        parameters (str): Arguments for the function, nested JSON.
        value (str): Value to send with the invocation, in wei.
    
    Returns:
        str: A message containing the result of the invocation.

    """
    abi = json.loads(get_abi(address))
    if parameters == "":
        parameters_dict = {}
    else:
        parameters_dict = json.loads(parameters)
    try:
        invocation_result = wallet.invoke_contract(address, method, abi, parameters_dict, value)
        invocation_result.wait()
    except Exception as e:
        return f"Error invoking contract: {e}"

    return f"Invoked method {method} in contract {address}.\nTransaction hash for the invocation: {invocation_result.transaction_hash}\nTransaction link for the invocation: {invocation_result.transaction_link}"

class InvokeContractAction(CdpAction):
    """Invoke contract action."""

    name: str = "invoke_contract"
    description: str = INVOKE_CONTRACT_PROMPT
    args_schema: Type[BaseModel] = InvokeContractInput
    func: Callable[..., str] = invoke_contract