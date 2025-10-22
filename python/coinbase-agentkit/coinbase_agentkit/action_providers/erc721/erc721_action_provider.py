"""ERC721 action provider."""

from typing import Any

from eth_typing import HexStr
from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import ERC721_ABI
from .schemas import GetBalanceSchema, MintSchema, TransferSchema


class Erc721ActionProvider(ActionProvider[EvmWalletProvider]):
    """Action provider for ERC721 contract interactions."""

    def __init__(self) -> None:
        """Initialize the ERC721 action provider."""
        super().__init__("erc721", [])

    @create_action(
        name="mint",
        description="""
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation.
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs.
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
""",
        schema=MintSchema,
    )
    def mint(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Mint an NFT (ERC-721) to a specified destination address.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            contract = Web3().eth.contract(address=args["contract_address"], abi=ERC721_ABI)
            data = contract.encode_abi("mint", args=[args["destination"], 1])

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": HexStr(args["contract_address"]),
                    "data": HexStr(data),
                }
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Successfully minted NFT {args['contract_address']} to {args['destination']}"
        except Exception as e:
            return f"Error minting NFT {args['contract_address']} to {args['destination']}: {e}"

    @create_action(
        name="transfer",
        description="""
This tool will transfer an NFT (ERC721 token) from the wallet to another onchain address.

It takes the following inputs:
- contractAddress: The NFT contract address
- tokenId: The ID of the specific NFT to transfer
- destination: Onchain address to send the NFT

Important notes:
- Ensure you have ownership of the NFT before attempting transfer
- Ensure there is sufficient native token balance for gas fees
- The wallet must either own the NFT or have approval to transfer it
""",
        schema=TransferSchema,
    )
    def transfer(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Transfer an NFT (ERC721 token) to a destination address.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            contract = Web3().eth.contract(address=args["contract_address"], abi=ERC721_ABI)
            from_address = args.get("from_address") or wallet_provider.get_address()

            data = contract.encode_abi(
                "transferFrom",
                args=[from_address, args["destination"], int(args["token_id"])],
            )

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": HexStr(args["contract_address"]),
                    "data": HexStr(data),
                }
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return (
                f"Successfully transferred NFT {args['contract_address']} with tokenId "
                f"{args['token_id']} to {args['destination']}"
            )
        except Exception as e:
            return (
                f"Error transferring NFT {args['contract_address']} with tokenId "
                f"{args['token_id']} to {args['destination']}: {e}"
            )

    @create_action(
        name="get_balance",
        description="""
This tool will check the NFT (ERC721 token) balance for a given address.

It takes the following inputs:
- contractAddress: The NFT contract address to check balance for
- address: (Optional) The address to check NFT balance for. If not provided, uses the wallet's address
""",
        schema=GetBalanceSchema,
    )
    def get_balance(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get the NFT balance for a given address and contract.

        This function queries an ERC721 NFT contract to get the token balance for a specific address.
        It uses the standard ERC721 balanceOf function which returns the number of tokens owned by
        the given address for that NFT collection.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider to use for making the contract call
            args (dict[str, Any]): The input arguments containing:
                - contract_address (str): The address of the ERC721 NFT contract to query
                - address (str, optional): The address to check NFT balance for. If not provided,
                    uses the wallet's default address

        Returns:
            str: A message containing either:
                - The NFT balance details if successful
                - An error message if the balance check fails

        Raises:
            Exception: If the contract call fails for any reason

        """
        try:
            address = args.get("address") or wallet_provider.get_address()

            balance = wallet_provider.read_contract(
                {
                    "address": HexStr(args["contract_address"]),
                    "abi": ERC721_ABI,
                    "function_name": "balanceOf",
                    "args": [address],
                }
            )

            return (
                f"Balance of NFTs for contract {args['contract_address']} at address {address} is "
                f"{balance}"
            )
        except Exception as e:
            return f"Error getting NFT balance for contract {args['contract_address']}: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if the ERC721 action provider supports the given network.

        Args:
            network: The network to check.

        Returns:
            True if the ERC721 action provider supports the network, false otherwise.

        """
        return network.protocol_family == "evm"


def erc721_action_provider() -> Erc721ActionProvider:
    """Create an instance of the ERC721 action provider.

    Returns:
        An instance of the ERC721 action provider.

    """
    return Erc721ActionProvider()
