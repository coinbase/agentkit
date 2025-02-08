from collections.abc import Callable
from typing import Optional

from cdp import Cdp, Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

GET_TRANSACTIONS_PROMPT = """
This tool will get the last transactions of an address.
It takes the address ID as input.
"""


class GetTransactionsInput(BaseModel):
    """Input argument schema for get transactions action."""

    address_id: str = Field(
        ...,
        description="The address ID to get the transactions for.",
    )
    limit: Optional[int] = Field(
        10,
        description="A limit on the number of transactions to be returned. Limit can range between 1 and 100, and the default is 10.",
    )

def wei_to_eth(wei_value: int) -> float:
    """Convert wei to ETH."""
    return wei_value / 10**18

# TODO: Clean this up
def _fix_num(instance, schema):
    value = instance.value
    if "EthereumTransaction" in schema and int(value) != 0:
        return wei_to_eth(int(value))
    elif instance.token_transfers and int(instance.token_transfers[0].value) != 0:
        return int(instance.token_transfers[0].value)/1000000
    return value

def get_transactions(wallet: Wallet, address_id: str, limit: Optional[int]) -> str:
    """Get last transactions for the address defined

    Args:
        wallet (Wallet): The wallet to get the transactions for.
        address_id (str): The address ID to get the transactions for.
        limit (int): The limit on the number of transactions to be returned.

    Returns:
        str: A message containing the transaction information of the address.

    """
    try:
        transactions = Cdp.api_clients.transaction_history.list_address_transactions(
            network_id=wallet.network_id, address_id=address_id, limit=limit
        )
    except Exception as e:
        return f"Error getting transactions for address {address_id}: {e!s}"

    # Format each transaction entry on a new line
    transaction_lines = []
    for tx in transactions.data:
        transaction_lines.append(
            f"Transaction Hash: {tx.transaction_hash}\n"
            f"From: {tx.from_address_id=}\n"
            f"To: {tx.to_address_id=}\n"
            f"Value: {_fix_num(tx.content.actual_instance, tx.content.one_of_schemas)}\n"
            f"Status: {tx.status}\n"
            f"Link: {tx.transaction_link}\n"
        )
    formatted_transactions = "\n".join(transaction_lines)
    return f"Transactions for address {address_id}:\n{formatted_transactions}"



class GetTransactionsAction(CdpAction):
    """Get wallet transactions action."""

    name: str = "get_transactions"
    description: str = GET_TRANSACTIONS_PROMPT
    args_schema: type[BaseModel] | None = GetTransactionsInput
    func: Callable[..., str] = get_transactions