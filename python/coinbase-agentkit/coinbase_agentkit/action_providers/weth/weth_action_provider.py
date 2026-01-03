from typing import Any

from eth_utils import to_wei
from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from ..erc20.constants import ERC20_ABI, TOKEN_ADDRESSES_BY_SYMBOLS
from .constants import WETH_ABI
from .schemas import UnwrapEthSchema, WrapEthSchema


def get_weth_address(network: Network) -> str | None:
    """Get the WETH address for the given network.

    Args:
        network: The network to get the WETH address for.

    Returns:
        The WETH address for the network, or None if not supported.

    """
    network_tokens = TOKEN_ADDRESSES_BY_SYMBOLS.get(network.network_id)
    return network_tokens.get("WETH") if network_tokens else None


class WethActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with WETH."""

    def __init__(self):
        super().__init__("weth", [])

    @create_action(
        name="wrap_eth",
        description="""
        This tool wraps ETH to WETH.

        Inputs:
        - Amount of ETH to wrap in human-readable format (e.g., 0.1 for 0.1 ETH).
        """,
        schema=WrapEthSchema,
    )
    def wrap_eth(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Wrap ETH to WETH by calling the deposit function on the WETH contract.

        Args:
            wallet_provider: The wallet provider to wrap ETH from.
            args: Arguments containing amount_to_wrap in human-readable format.

        Returns:
            A message containing the transaction hash.

        """
        try:
            validated_args = WrapEthSchema(**args)
            network = wallet_provider.get_network()
            weth_address = get_weth_address(network)

            if not weth_address:
                return f"Error: WETH not supported on network {network.network_id}"

            # Convert human-readable ETH amount to wei (ETH has 18 decimals)
            amount_in_wei = to_wei(validated_args.amount_to_wrap, "ether")

            # Check ETH balance before wrapping
            eth_balance = wallet_provider.get_balance()

            if eth_balance < int(amount_in_wei):
                eth_balance_formatted = Web3.from_wei(eth_balance, "ether")
                return f"Error: Insufficient ETH balance. Requested to wrap {validated_args.amount_to_wrap} ETH, but only {eth_balance_formatted} ETH is available."

            contract = Web3().eth.contract(address=weth_address, abi=WETH_ABI)
            data = contract.encode_abi("deposit", args=[])

            tx_hash = wallet_provider.send_transaction(
                {"to": weth_address, "data": data, "value": str(amount_in_wei)}
            )
            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return (
                f"Wrapped {validated_args.amount_to_wrap} ETH to WETH. Transaction hash: {tx_hash}"
            )
        except Exception as e:
            return f"Error wrapping ETH: {e}"

    @create_action(
        name="unwrap_eth",
        description="""
        This tool unwraps WETH to ETH.

        Inputs:
        - Amount of WETH to unwrap in human-readable format (e.g., 0.1 for 0.1 WETH).
        """,
        schema=UnwrapEthSchema,
    )
    def unwrap_eth(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Unwrap WETH to ETH by calling the withdraw function on the WETH contract.

        Args:
            wallet_provider: The wallet provider to unwrap WETH from.
            args: Arguments containing amount_to_unwrap in human-readable format.

        Returns:
            A message containing the transaction hash.

        """
        try:
            validated_args = UnwrapEthSchema(**args)
            network = wallet_provider.get_network()
            weth_address = get_weth_address(network)

            if not weth_address:
                return f"Error: WETH not supported on network {network.network_id}"

            # Convert human-readable WETH amount to wei (WETH has 18 decimals)
            amount_in_wei = to_wei(validated_args.amount_to_unwrap, "ether")

            # Check WETH balance before unwrapping
            weth_balance = wallet_provider.read_contract(
                contract_address=Web3.to_checksum_address(weth_address),
                abi=ERC20_ABI,
                function_name="balanceOf",
                args=[Web3.to_checksum_address(wallet_provider.get_address())],
            )

            if weth_balance < int(amount_in_wei):
                weth_balance_formatted = Web3.from_wei(weth_balance, "ether")
                return f"Error: Insufficient WETH balance. Requested to unwrap {validated_args.amount_to_unwrap} WETH, but only {weth_balance_formatted} WETH is available."

            contract = Web3().eth.contract(address=weth_address, abi=WETH_ABI)
            data = contract.encode_abi("withdraw", args=[amount_in_wei])

            tx_hash = wallet_provider.send_transaction({"to": weth_address, "data": data})
            wallet_provider.wait_for_transaction_receipt(tx_hash)

            return f"Unwrapped {validated_args.amount_to_unwrap} WETH to ETH. Transaction hash: {tx_hash}"
        except Exception as e:
            return f"Error unwrapping WETH: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by WETH actions.

        Args:
            network: The network to check support for.

        Returns:
            True if the network is supported, False otherwise.

        """
        return get_weth_address(network) is not None


def weth_action_provider() -> WethActionProvider:
    """Create a new WethActionProvider instance.

    Returns:
        A new instance of the WETH action provider.

    """
    return WethActionProvider()
