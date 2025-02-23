from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import WETH_ABI, WETH_ADDRESS
from .schemas import WrapEthSchema

SUPPORTED_CHAINS = ["8453", "84532"]


class WethActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with WETH."""

    def __init__(self):
        super().__init__("weth", [])

    @create_action(
        name="wrap_eth",
        description="""
    This tool can only be used to wrap ETH to WETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- Amount of ETH to wrap.

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 WETH
- Minimum purchase amount is 100000000000000 wei (0.0001 WETH)
""",
        schema=WrapEthSchema,
    )
    def wrap_eth(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Wrap ETH to WETH by calling the deposit function on the WETH contract.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider to wrap ETH from.
            args (dict[str, Any]): Arguments containing amount_to_wrap in wei.

        Returns:
            str: A message containing the wrap details or error message.

        """
        try:
            validated_args = WrapEthSchema(**args)

            contract = Web3().eth.contract(address=WETH_ADDRESS, abi=WETH_ABI)
            data = contract.encode_abi("deposit", args=[])

            tx_hash = wallet_provider.send_transaction(
                {"to": WETH_ADDRESS, "data": data, "value": validated_args.amount_to_wrap}
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Wrapped ETH with transaction hash: {tx_hash}"
        except Exception as e:
            return f"Error wrapping ETH: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by WETH actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: True if the network is supported, False otherwise.

        """
        return network.chain_id in SUPPORTED_CHAINS


def weth_action_provider() -> WethActionProvider:
    """Create a new WethActionProvider instance.

    Returns:
        WethActionProvider: A new instance of the WETH action provider.

    """
    return WethActionProvider()
