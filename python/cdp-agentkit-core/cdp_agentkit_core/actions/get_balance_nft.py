from collections.abc import Callable

from cdp import Wallet
from cdp.smart_contract import SmartContract
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

GET_BALANCE_NFT_PROMPT = """
This tool will get the NFTs (ERC721 tokens) owned by the wallet for a specific NFT contract.

It takes the following inputs:
- contract_address: The NFT contract address to check
- address: (Optional) The address to check NFT balance for. If not provided, uses the wallet's default address
"""


class GetBalanceNftInput(BaseModel):
    """Input argument schema for get NFT balance action."""

    contract_address: str = Field(..., description="The NFT contract address to check balance for")
    address: str | None = Field(
        None,
        description="The address to check NFT balance for. If not provided, uses the wallet's default address",
    )


def get_balance_nft(
    wallet: Wallet,
    contract_address: str,
    address: str | None = None,
) -> str:
    """Get NFT balance for a specific contract.

    Args:
        wallet (Wallet): The wallet to check balance from.
        contract_address (str): The NFT contract address.
        address (str | None): The address to check balance for. Defaults to wallet's default address.

    Returns:
        str: A message containing the NFT balance details.

    """
    try:
        check_address = address if address is not None else wallet.default_address.address_id

        owned_tokens = SmartContract.read(
            wallet.network_id, contract_address, "tokensOfOwner", args={"owner": check_address}
        )

        if not owned_tokens:
            return f"Address {check_address} owns no NFTs in contract {contract_address}"

        token_list = ", ".join(str(token_id) for token_id in owned_tokens)
        return f"Address {check_address} owns {len(owned_tokens)} NFTs in contract {contract_address}.\nToken IDs: {token_list}"

    except Exception as e:
        return f"Error getting NFT balance for address {check_address} in contract {contract_address}: {e!s}"


class GetBalanceNftAction(CdpAction):
    """Get NFT balance action."""

    name: str = "get_balance_nft"
    description: str = GET_BALANCE_NFT_PROMPT
    args_schema: type[BaseModel] | None = GetBalanceNftInput
    func: Callable[..., str] = get_balance_nft
