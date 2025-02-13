"""Basename action provider for Base domain name registration."""

from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import (
    BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET,
    BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET,
    L2_RESOLVER_ABI,
    L2_RESOLVER_ADDRESS_MAINNET,
    L2_RESOLVER_ADDRESS_TESTNET,
    REGISTRAR_ABI,
    REGISTRATION_DURATION,
)
from .schemas import RegisterBasenameSchema


class BasenameActionProvider(ActionProvider[EvmWalletProvider]):
    """Action provider for Basename registration."""

    def __init__(self) -> None:
        """Initialize the Basename action provider."""
        super().__init__("basename", [])

    @create_action(
        name="register_basename",
        description="""
This tool will register a Basename for the agent. The agent should have a wallet associated to register a Basename.
When your network ID is 'base-mainnet' (also sometimes known simply as 'base'), the name must end with .base.eth, and when your network ID is 'base-sepolia', it must ends with .basetest.eth.
Do not suggest any alternatives and never try to register a Basename with another postfix. The prefix of the name must be unique so if the registration of the
Basename fails, you should prompt to try again with a more unique name.
""",
        schema=RegisterBasenameSchema,
    )
    def register_basename(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Register a Basename for the agent.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            address = Web3.to_checksum_address(wallet_provider.get_address())
            is_mainnet = wallet_provider.get_network().network_id == "base-mainnet"

            suffix = ".base.eth" if is_mainnet else ".basetest.eth"
            if not args["basename"].endswith(suffix):
                args["basename"] += suffix

            l2_resolver_address = Web3.to_checksum_address(
                L2_RESOLVER_ADDRESS_MAINNET if is_mainnet else L2_RESOLVER_ADDRESS_TESTNET
            )
            contract_address = Web3.to_checksum_address(
                BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET
                if is_mainnet
                else BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET
            )

            w3 = Web3()
            resolver_contract = w3.eth.contract(abi=L2_RESOLVER_ABI)
            registrar_contract = w3.eth.contract(abi=REGISTRAR_ABI)

            name_hash = w3.ens.namehash(args["basename"])

            address_data = resolver_contract.encode_abi("setAddr", args=[name_hash, address])
            name_data = resolver_contract.encode_abi("setName", args=[name_hash, args["basename"]])

            register_request = {
                "name": args["basename"].replace(suffix, ""),
                "owner": address,
                "duration": int(REGISTRATION_DURATION),
                "resolver": l2_resolver_address,
                "data": [address_data, name_data],
                "reverseRecord": True,
            }

            data = registrar_contract.encode_abi("register", args=[register_request])

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": contract_address,
                    "data": data,
                    "value": Web3.to_wei(args["amount"], "ether"),
                }
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Successfully registered basename {args['basename']} for address {address}"
        except Exception as e:
            return f"Error registering basename: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by the Basename action provider.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm" and network.network_id in [
            "base-mainnet",
            "base-sepolia",
        ]


def basename_action_provider() -> BasenameActionProvider:
    """Create a new Basename action provider.

    Returns:
        BasenameActionProvider: A new Basename action provider instance.

    """
    return BasenameActionProvider()
