from collections.abc import Callable

from cdp import Wallet
from cdp_agentkit_core.actions.utils import network_id_to_hex
from pydantic import BaseModel, Field
import requests
from cdp_agentkit_core.actions import CdpAction

GET_SPEND_PERMISSIONS_PROMPT = """
This tool will get the spend permissions that have been granted to the wallet and are approved to be used.
"""


class GetSpendPermissionsInput(BaseModel):
    """Input argument schema for get spend permissions action."""


def get_spend_permissions(wallet: Wallet) -> str:
    """Get spend permissions for the wallet.

    Args:
        wallet (Wallet): The wallet to get the spend permissions for.

    Returns:
        str: A message containing the spend permissions that are approved for the wallet.

    """
    hex_chain_id = network_id_to_hex(wallet.network_id)
    
    url = "https://rpc.wallet.coinbase.com"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
        "Origin": "https://wallet.coinbase.com",
        "Referer": "https://wallet.coinbase.com/"
    }
    payload = {
        "jsonrpc": "2.0",
        "method": "coinbase_fetchPermissions",
        "params": [{
            "chainId": hex_chain_id,
            "spender": wallet.default_address.address_id
        }],
        "id": 1
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status code: {response.status_code}")
        print(f"Raw response: {response.text}")
        
        if response.status_code == 200 and response.text:
            return response.json()
        else:
            return f"Error: Status {response.status_code}, Response: {response.text}"
            
    except requests.exceptions.RequestException as e:
        return f"Request error: {str(e)}"
    except ValueError as e:
        return f"JSON decode error: {str(e)}"


class GetSpendPermissionsAction(CdpAction):
    """Get wallet spend permissions action."""

    name: str = "get_spend_permissions"
    description: str = GET_SPEND_PERMISSIONS_PROMPT
    args_schema: type[BaseModel] | None = GetSpendPermissionsInput
    func: Callable[..., str] = get_spend_permissions
