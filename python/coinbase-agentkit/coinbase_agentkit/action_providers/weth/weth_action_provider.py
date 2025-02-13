from typing import Any

from pydantic import ValidationError
from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import WETH_ABI, WETH_ADDRESS
from .schemas import UnwrapWethInput, WrapEthInput

SUPPORTED_CHAINS = [8453, 84532]


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
- The amount should be specified in whole amounts of ETH (e.g., 1.5 for 1.5 ETH, 0.00005 for 0.00005 ETH)
- Make sure to use the correct amount provided, and if there's any doubt, check by getting more information before continuing with the action.
""",
        schema=WrapEthInput,
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
            validated_args = WrapEthInput(**args)
            # Convert human-readable ETH amount to wei
            amount_in_wei = str(int(float(validated_args.amount_to_wrap) * 10**18))

            contract = Web3().eth.contract(address=WETH_ADDRESS, abi=WETH_ABI)
            data = contract.encode_abi("deposit", args=[])

            tx_hash = wallet_provider.send_transaction(
                {
                    "to": WETH_ADDRESS,
                    "data": data,
                    "value": amount_in_wei,
                }
            )

            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Wrapped {validated_args.amount_to_wrap} ETH with transaction hash: {tx_hash}"
        except ValidationError as ve:
            return f"Error wrapping ETH: validation error: {ve}"
        except Exception as e:
            return f"Error wrapping ETH: {e}"

    @create_action(
        name="unwrap_eth",
        description="""
    This tool can only be used to unwrap WETH to ETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- Amount of WETH to unwrap.

Important notes:
- The amount should be specified in human-readable amounts of WETH (e.g., 1.5 for 1.5 WETH, 0.00005 for 0.00005 WETH)
- Make sure to use the correct amount provided, and if there's any doubt, check by getting more information before continuing with the action.
""",
        schema=UnwrapWethInput,
    )
    def unwrap_eth(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Unwrap WETH to ETH.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider to use for the action.
            args (dict): The input arguments for the action containing amount_to_unwrap.

        Returns:
            str: A message containing the transaction hash.

        Raises:
            ValidationError: If the input arguments are invalid.

        """
        try:
            validated_args = UnwrapWethInput(**args)
            # Convert human-readable WETH amount to wei as integer
            amount_in_wei = int(float(validated_args.amount_to_unwrap) * 10**18)

            contract = Web3().eth.contract(address=WETH_ADDRESS, abi=WETH_ABI)
            data = contract.encode_abi("withdraw", args=[amount_in_wei])
            tx_hash = wallet_provider.send_transaction(
                {
                    "to": WETH_ADDRESS,
                    "data": data,
                    "value": "0",
                }
            )
            wallet_provider.wait_for_transaction_receipt(tx_hash)
            return (
                f"Unwrapped {validated_args.amount_to_unwrap} WETH with transaction hash: {tx_hash}"
            )
        except ValidationError as ve:
            return f"Error unwrapping WETH: validation error: {ve}"
        except Exception as e:
            return f"Error unwrapping WETH: {e}"

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
