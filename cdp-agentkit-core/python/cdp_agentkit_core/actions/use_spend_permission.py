from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

USE_SPEND_PERMISSION_PROMPT = """
This tool will use a spend permission granted by another smart wallet. It takes in the account, token, allowance, period, start, and end as inputs.
"""


class UseSpendPermissionInput(BaseModel):
    """Input argument schema for use spend permission action."""

    account: str = Field(
        ...,
        description="The smart account that this spend permission is valid for",
    )

    token: str = Field(
        ...,
        description="The token address (ERC-7528 native token or ERC-20 contract)",
    )
    allowance: str = Field(
        ...,
        description="The maximum allowed value to spend within each period",
    )
    period: str = Field(
        ...,
        description="The time duration for resetting used `allowance` on a recurring basis (seconds)",
    )
    start: str = Field(
        ...,
        description="The timestamp this spend permission is valid starting at (inclusive, unix seconds)",
    )
    end: str = Field(
        ...,
        description="The timestamp this spend permission is valid until (exclusive, unix seconds)",
    )
    amount: str = Field(
        ...,
        description="The amount of the token to spend",
    )


def use_spend_permission(wallet: Wallet, account: str, token: str, allowance: str, period: str, start: str, end: str, amount: str) -> str:
    """Use a spend permission granted by another smart wallet.

    Args:
        wallet (Wallet): The wallet to use the spend permission from.
        account (str): The smart account that this spend permission is valid for.
        token (str): The token address (ERC-7528 native token or ERC-20 contract).
        allowance (str): The maximum allowed value to spend within each period.
        period (str): The time duration for resetting used `allowance` on a recurring basis (seconds).
        start (str): The timestamp this spend permission is valid starting at (inclusive, unix seconds).
        end (str): The timestamp this spend permission is valid until (exclusive, unix seconds).

    Returns:
        str: A message containing the spend permission details.

    """
    BASE_MAINNET_SPEND_PERMISSIONS_CONTRACT_ADDRESS = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad"
    
    SPEND_FUNCTION_ABI = [{
        "inputs": [
            {
                "components": [
                    {"internalType": "address", "name": "account", "type": "address"},
                    {"internalType": "address", "name": "spender", "type": "address"},
                    {"internalType": "address", "name": "token", "type": "address"},
                    {"internalType": "uint160", "name": "allowance", "type": "uint160"},
                    {"internalType": "uint48", "name": "period", "type": "uint48"},
                    {"internalType": "uint48", "name": "start", "type": "uint48"},
                    {"internalType": "uint48", "name": "end", "type": "uint48"},
                    {"internalType": "uint256", "name": "salt", "type": "uint256"},
                    {"internalType": "bytes", "name": "extraData", "type": "bytes"}
                ],
                "internalType": "struct SpendPermissionManager.SpendPermission",
                "name": "spendPermission",
                "type": "tuple"
            },
            {
                "internalType": "uint160",
                "name": "value",
                "type": "uint160"
            }
        ],
        "name": "spend",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }]
    
    try:        
        spend_permission_transaction = wallet.invoke_contract(
            contract_address=BASE_MAINNET_SPEND_PERMISSIONS_CONTRACT_ADDRESS,
            method="spend",
            args={
                "spendPermission": [
                    account,
                    wallet.default_address.address_id,
                    token,
                    allowance,
                    period,
                    start,
                    end,
                    "3",
                    "0x",
                ],
                "value": amount,
            },
            abi=SPEND_FUNCTION_ABI,
            amount=0,
        )
        
        spend_permission_transaction.wait()
    except Exception as e:
        return f"Error using spend permission {e!s}"

    return f"Used spend permission for {amount} of {token} from {account} to {wallet.default_address.address_id} on network {wallet.network_id}.\nTransaction hash for the spend permission: {spend_permission_transaction.transaction_hash}\nTransaction link for the spend permission: {spend_permission_transaction.transaction_link}"


class UseSpendPermissionAction(CdpAction):
    """Use spend permission action."""

    name: str = "use_spend_permission"
    description: str = USE_SPEND_PERMISSION_PROMPT
    args_schema: type[BaseModel] | None = UseSpendPermissionInput
    func: Callable[..., str] = use_spend_permission
