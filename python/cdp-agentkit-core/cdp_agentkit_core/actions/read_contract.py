from langchain.tools import BaseTool
from typing import Optional, Type
from pydantic import BaseModel, Field
from collections.abc import Callable
import json

from cdp import Wallet, SmartContract
from cdp_agentkit_core.actions import CdpAction
from web3 import Web3

from .get_abi import get_abi

READ_CONTRACT_PROMPT = """
This tool will call a readonly function in a contract.
Example usage: {"address": "0x1234...5678", "method": "functionName", "parameters": "{\"to\": \"0x1234...5678\", \"value\": \"100...000\"}"}
"""

class ReadContractInput(BaseModel):
    """Input argument schema for read contract action."""

    address: str = Field(..., description="Address of the contract to invoke, e.g., '0x1234...5678'")
    method: str = Field(..., description="Method signature to invoke, e.g., 'functionName'")
    parameters: str = Field(..., description='Arguments for the function, e.g., "{\"to\": \"0x1234...5678\", \"value\": \"100...000\"}", it should be nested JSON')

def read_contract(wallet: Wallet, address: str, method: str, parameters: str) -> str:
    """Call a readonly function in a contract.

    Args:
        wallet (Wallet): The wallet to call the contract with.
        address (str): The address of the contract to call.
        method (str): The method signature to call.
        parameters (str): Arguments for the function, nested JSON.
    
    Returns:
        str: A message containing the result of the call.

    """
    abi = json.loads(get_abi(address))
    if parameters == "":
        parameters_dict = {}
    else:
        parameters_dict = json.loads(parameters)
    try:
        result = SmartContract.read(wallet.network_id, address, method, abi, parameters_dict)
    except Exception as e:
        return f"Error calling contract: {e}"
    return f"Called method {method} in contract {address}.\nResult: {result}"

class ReadContractAction(CdpAction):
    """Read contract action."""
    name: str = "read_contract"
    description: str = READ_CONTRACT_PROMPT
    args_schema: Type[BaseModel] = ReadContractInput
    func: Callable[..., str] = read_contract