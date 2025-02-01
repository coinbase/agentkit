from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

MINT_NFT_PROMPT = """
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs.
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
"""


class MintNftInput(BaseModel):
    """Input argument schema for mint NFT action."""

    contract_address: str = Field(
        ...,
        description="The contract address of the NFT (ERC-721) to mint, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )
    destination: str = Field(
        ...,
        description="The destination address that will receive the NFT onchain, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
    )


def mint_nft(wallet: Wallet, contract_address: str, destination: str) -> str:
    """Mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.

    Args:
        wallet (Wallet): The wallet to trade the asset from.
        contract_address (str): The contract address of the NFT (ERC-721) to mint, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
        destination (str): The destination address that will receive the NFT onchain, e.g. `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

    Returns:
        str: A message containing the NFT mint details.

    """
    mint_args = {"to": destination, "quantity": "1"}

    try:
        mint_invocation = wallet.invoke_contract(
            contract_address=contract_address, method="mint", args=mint_args
        ).wait()
    except Exception as e:
        return f"Error minting NFT {e!s}"

    return f"Minted NFT from contract {contract_address} to address {destination} on network {wallet.network_id}.\nTransaction hash for the mint: {mint_invocation.transaction.transaction_hash}\nTransaction link for the mint: {mint_invocation.transaction.transaction_link}"


class MintNftAction(CdpAction):
    """Mint NFT action."""

    name: str = "mint_nft"
    description: str = MINT_NFT_PROMPT
    args_schema: type[BaseModel] | None = MintNftInput
    func: Callable[..., str] = mint_nft
