"""Superfluid action provider."""

from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import CREATE_ABI, DELETE_ABI, SUPERFLUID_HOST_ADDRESS, UPDATE_ABI
from .schemas import CreateFlowSchema, DeleteFlowSchema, UpdateFlowSchema


class SuperfluidActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with Superfluid protocol."""

    def __init__(self):
        super().__init__("superfluid", [])

    @create_action(
        name="create_flow",
        description="""
This tool will create a money flow to a specified token recipient using Superfluid. Do not use this tool for any other purpose, or trading other assets.
Inputs:
- Wallet address to send the tokens to
- Super token contract address
- The flowrate of flow in wei per second
Important notes:
- The token must be a Superfluid Super token. If errors occur, confirm that the token is a valid Superfluid Super token.
- The flowrate cannot have any decimal points, since the unit of measurement is wei per second.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 ETH""",
        schema=CreateFlowSchema,
    )
    def create_flow(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Create a money flow using Superfluid.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            superfluid_host_contract = Web3().eth.contract(
                address=SUPERFLUID_HOST_ADDRESS, abi=CREATE_ABI
            )

            encoded_data = superfluid_host_contract.encode_abi(
                "createFlow",
                args=[
                    args["token_address"],
                    wallet_provider.get_address(),
                    args["recipient"],
                    int(args["flow_rate"]),
                    "0x",
                ],
            )

            params = {"to": SUPERFLUID_HOST_ADDRESS, "data": encoded_data}

            tx_hash = wallet_provider.send_transaction(params)

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Flow created successfully. Transaction hash: {tx_hash}"

        except Exception as e:
            return f"Error creating flow: {e!s}"

    @create_action(
        name="update_flow",
        description="""
This tool will update an existing money flow to a specified token recipient using Superfluid. Do not use this tool for any other purpose, or trading other assets.
Inputs:
- Wallet address that the tokens are being streamed to
- Super token contract address
- The new flowrate of flow in wei per second
Important notes:
- The flowrate cannot have any decimal points, since the unit of measurement is wei per second.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 ETH""",
        schema=UpdateFlowSchema,
    )
    def update_flow(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Update an existing money flow using Superfluid.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            superfluid_host_contract = Web3().eth.contract(
                address=SUPERFLUID_HOST_ADDRESS, abi=UPDATE_ABI
            )

            encoded_data = superfluid_host_contract.encode_abi(
                "updateFlow",
                args=[
                    args["token_address"],
                    wallet_provider.get_address(),
                    args["recipient"],
                    int(args["new_flow_rate"]),
                    "0x",
                ],
            )

            params = {"to": SUPERFLUID_HOST_ADDRESS, "data": encoded_data}

            tx_hash = wallet_provider.send_transaction(params)

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Flow updated successfully. Transaction hash: {tx_hash}"

        except Exception as e:
            return f"Error updating flow: {e!s}"

    @create_action(
        name="delete_flow",
        description="""
This tool will delete an existing money flow to a token recipient using Superfluid. Do not use this tool for any other purpose, or trading other assets.
Inputs:
- Wallet address that the tokens are being streamed to or being streamed from
- Super token contract address""",
        schema=DeleteFlowSchema,
    )
    def delete_flow(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Delete an existing money flow using Superfluid.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            superfluid_host_contract = Web3().eth.contract(
                address=SUPERFLUID_HOST_ADDRESS, abi=DELETE_ABI
            )

            encoded_data = superfluid_host_contract.encode_abi(
                "deleteFlow",
                args=[
                    args["token_address"],
                    wallet_provider.get_address(),
                    args["recipient"],
                    "0x",
                ],
            )

            params = {"to": SUPERFLUID_HOST_ADDRESS, "data": encoded_data}

            tx_hash = wallet_provider.send_transaction(params)

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Flow deleted successfully. Transaction hash: {tx_hash}"

        except Exception as e:
            return f"Error deleting flow: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Superfluid actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm"


def superfluid_action_provider() -> SuperfluidActionProvider:
    """Create a new Superfluid action provider.

    Returns:
        SuperfluidActionProvider: A new Superfluid action provider instance.

    """
    return SuperfluidActionProvider()
