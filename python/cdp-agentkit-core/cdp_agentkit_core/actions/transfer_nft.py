from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

TRANSFER_NFT_PROMPT = """
This tool will transfer an NFT (ERC721 token) from the wallet to another onchain address.

It takes the following inputs:
- contract_address: The NFT contract address
- token_id: The ID of the specific NFT to transfer
- destination: Where to send the NFT (can be an onchain address, ENS 'example.eth', or Basename 'example.base.eth')

Important notes:
- Ensure you have ownership of the NFT before attempting transfer
- Ensure there is sufficient native token balance for gas fees
- The wallet must either own the NFT or have approval to transfer it
"""


class TransferNftInput(BaseModel):
    """Input argument schema for NFT transfer action."""

    contract_address: str = Field(..., description="The NFT contract address to interact with")
    token_id: str = Field(..., description="The ID of the NFT to transfer")
    destination: str = Field(
        ...,
        description="The destination to transfer the NFT, e.g. `0x58dBecc0894Ab4C24F98a0e684c989eD07e4e027`, `example.eth`, `example.base.eth`",
    )
    from_address: str = Field(
        default=None,
        description="The address to transfer from. If not provided, defaults to the wallet's default address",
    )


def transfer_nft(
    wallet: Wallet,
    contract_address: str,
    token_id: str,
    destination: str,
    from_address: str | None = None,
) -> str:
    """Transfer an NFT (ERC721 token) to a destination address.

    Args:
        wallet (Wallet): The wallet to transfer the NFT from.
        contract_address (str): The NFT contract address.
        token_id (str): The ID of the NFT to transfer.
        destination (str): The destination to transfer the NFT.
        from_address (str | None): The address to transfer from. Defaults to wallet's default address.

    Returns:
        str: A message containing the transfer details.

    """
    try:
        from_addr = from_address if from_address is not None else wallet.default_address.address_id
        transfer_result = wallet.invoke_contract(
            contract_address=contract_address,
            method="transferFrom",
            args={"from": from_addr, "to": destination, "tokenId": token_id},
        ).wait()
    except Exception as e:
        return f"Error transferring the NFT (contract: {contract_address}, ID: {token_id}) from {from_addr} to {destination}): {e!s}"

    return f"Transferred NFT (ID: {token_id}) from contract {contract_address} to {destination}.\nTransaction hash: {transfer_result.transaction_hash}\nTransaction link: {transfer_result.transaction_link}"


class TransferNftAction(CdpAction):
    """Transfer NFT action."""

    name: str = "transfer_nft"
    description: str = TRANSFER_NFT_PROMPT
    args_schema: type[BaseModel] | None = TransferNftInput
    func: Callable[..., str] = transfer_nft
