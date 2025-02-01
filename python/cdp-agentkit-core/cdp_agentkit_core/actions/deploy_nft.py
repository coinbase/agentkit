from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction

DEPLOY_NFT_PROMPT = """
This tool will deploy an NFT (ERC-721) contract onchain from the wallet.
It takes the name of the NFT collection, the symbol of the NFT collection, and the base URI for the token metadata as inputs.
"""


class DeployNftInput(BaseModel):
    """Input argument schema for deploy NFT action."""

    name: str = Field(
        ...,
        description="The name of the NFT (ERC-721) token collection to deploy, e.g. `Helpful Hippos`",
    )
    symbol: str = Field(
        ...,
        description="The symbol of the NFT (ERC-721) token collection to deploy, e.g. `HIPPO`",
    )
    base_uri: str = Field(
        ...,
        description="The base URI for the NFT (ERC-721) token collection's metadata, e.g. `https://www.helpfulhippos.xyz/metadata/`",
    )


def deploy_nft(wallet: Wallet, name: str, symbol: str, base_uri: str) -> str:
    """Deploy an NFT (ERC-721) token collection onchain from the wallet.

    Args:
        wallet (Wallet): The wallet to deploy the NFT from.
        name (str): The name of the NFT (ERC-721) token collection to deploy, e.g. `Helpful Hippos`.
        symbol (str): The symbol of the NFT (ERC-721) token collection to deploy, e.g. `HIPPO`.
        base_uri (str): The base URI for the NFT (ERC-721) token collection's metadata, e.g. `https://www.helpfulhippos.xyz/metadata/`.

    Returns:
        str: A message containing the NFT token deployment details.

    """
    try:
        nft_contract = wallet.deploy_nft(name=name, symbol=symbol, base_uri=base_uri).wait()
    except Exception as e:
        return f"Error deploying NFT {e!s}"

    return f"Deployed NFT Collection {name} to address {nft_contract.contract_address} on network {wallet.network_id}.\nTransaction hash for the deployment: {nft_contract.transaction.transaction_hash}\nTransaction link for the deployment: {nft_contract.transaction.transaction_link}"


class DeployNftAction(CdpAction):
    """Deploy NFT action."""

    name: str = "deploy_nft"
    description: str = DEPLOY_NFT_PROMPT
    args_schema: type[BaseModel] | None = DeployNftInput
    func: Callable[..., str] = deploy_nft
