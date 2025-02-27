"""ERC20 action provider."""

from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import ERC20_ABI
from .schemas import GetBalanceSchema, TransferSchema


class ERC20ActionProvider(ActionProvider[EvmWalletProvider]):
    """Action provider for ERC20 tokens."""

    def __init__(self) -> None:
        """Initialize the ERC20 action provider."""
        super().__init__("erc20", [])

    @create_action(
        name="get_balance",
        description="""
        This tool will get the balance of an ERC20 asset in the wallet. It takes the contract address as input.
        """,
        schema=GetBalanceSchema,
    )
    def get_balance(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get the balance of an ERC20 token for the wallet's address.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = GetBalanceSchema(**args)

            balance = wallet_provider.read_contract(
                contract_address=Web3.to_checksum_address(validated_args.contract_address),
                abi=ERC20_ABI,
                function_name="balanceOf",
                args=[wallet_provider.get_address()],
            )

            decimals = wallet_provider.read_contract(
                contract_address=validated_args.contract_address,
                abi=ERC20_ABI,
                function_name="decimals",
                args=[],
            )

            return f"Balance of {validated_args.contract_address} is {balance / 10 ** decimals}"
        except Exception as e:
            return f"Error getting balance: {e!s}"

    @create_action(
        name="transfer",
        description="""
        This tool will transfer an ERC20 token from the wallet to another onchain address.

        It takes the following inputs:
        - amount: The amount to transfer
        - contract_address: The contract address of the token to transfer
        - destination: Where to send the tokens

        Important notes:
        - Ensure sufficient balance of the input asset before transferring
        - When sending native assets (e.g. 'eth' on base-mainnet), ensure there is sufficient balance for the transfer itself AND the gas cost of this transfer
        """,
        schema=TransferSchema,
    )
    def transfer(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Transfer ERC20 tokens to a destination address.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            validated_args = TransferSchema(**args)

            contract = Web3().eth.contract(address=validated_args.contract_address, abi=ERC20_ABI)
            data = contract.encode_abi(
                "transfer", [validated_args.destination, int(validated_args.amount)]
            )

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": validated_args.contract_address,
                    "data": data,
                }
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return (
                f"Transferred {validated_args.amount} of {validated_args.contract_address} "
                f"to {validated_args.destination}.\n"
                f"Transaction hash for the transfer: {tx_hash}"
            )
        except Exception as e:
            return f"Error transferring the asset: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm"


def erc20_action_provider() -> ERC20ActionProvider:
    """Create a new instance of the ERC20 action provider.

    Returns:
        A new ERC20 action provider instance.

    """
    return ERC20ActionProvider()
