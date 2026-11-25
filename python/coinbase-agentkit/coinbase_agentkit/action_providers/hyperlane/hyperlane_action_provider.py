"""Hyperlane action provider for cross-chain Warp Route token transfers."""

from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import DESTINATION_DOMAINS, SUPPORTED_NETWORKS, WARP_ROUTE_ABI
from .schemas import HyperlaneQuoteGasSchema, HyperlaneTransferRemoteSchema
from .utils import (
    address_to_bytes32,
    approve_token,
    format_amount_from_decimals,
    format_amount_with_decimals,
    get_token_balance,
    get_token_decimals,
    get_token_symbol,
)


class HyperlaneActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for cross-chain transfers via Hyperlane Warp Routes."""

    def __init__(self):
        """Initialize the Hyperlane action provider."""
        super().__init__("hyperlane", [])

    def supports_network(self, network: Network) -> bool:
        """Check if the current network is supported as a transfer origin.

        Args:
            network: The network to check.

        Returns:
            bool: True if the network is a supported origin chain.

        """
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS

    def _get_destination_domain(self, destination: str) -> int:
        """Resolve a destination chain name to a Hyperlane domain ID.

        Args:
            destination: Chain name (e.g. "ethereum", "optimism").

        Returns:
            int: The Hyperlane uint32 domain ID.

        """
        key = destination.strip().lower()
        if key not in DESTINATION_DOMAINS:
            supported = ", ".join(sorted(DESTINATION_DOMAINS.keys()))
            raise ValueError(
                f"Unsupported destination chain '{destination}'. "
                f"Supported destinations: {supported}"
            )
        return DESTINATION_DOMAINS[key]

    @create_action(
        name="transfer_remote",
        description="""
This tool sends an ERC-20 token to a recipient on another chain via a Hyperlane Warp Route.
It takes:
- warp_route_address: Address of the Hyperlane Warp Route (TokenRouter) on the current chain
- destination: Destination chain name (e.g. `ethereum`, `optimism`, `arbitrum`, `base`, `polygon`, `bsc`)
- recipient: Recipient EVM address on the destination chain
- amount: Amount to send in human-readable units (e.g. `100` for 100 USDC)
- token_address: Address of the underlying ERC-20 on the current chain (used to read decimals and approve the Warp Route)

Important notes:
- The current wallet network is the origin chain. The transfer is dispatched from there.
- The current wallet must hold enough of the underlying ERC-20 to cover `amount`.
- The current wallet must hold enough native gas token to cover both the Warp Route's interchain gas payment AND the origin-chain gas for the transferRemote transaction.
- The Warp Route contract is approved to spend the underlying token before transferRemote is called.
- The interchain gas payment is read from the Warp Route via quoteGasPayment and attached to the transferRemote call as msg.value.
""",
        schema=HyperlaneTransferRemoteSchema,
    )
    def transfer_remote(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Send an ERC-20 transfer to a recipient on another chain via a Warp Route.

        Args:
            wallet_provider: The wallet to send the transfer from.
            args: The transfer parameters.

        Returns:
            str: A message describing the result of the transfer.

        """
        try:
            validated_args = HyperlaneTransferRemoteSchema(**args)
            network = wallet_provider.get_network()

            if not self.supports_network(network):
                return (
                    f"Error: Network {network.network_id} is not a supported "
                    f"Hyperlane origin chain"
                )

            try:
                domain = self._get_destination_domain(validated_args.destination)
            except ValueError as e:
                return f"Error: {e!s}"

            warp_route = Web3.to_checksum_address(validated_args.warp_route_address)
            token_address = Web3.to_checksum_address(validated_args.token_address)
            recipient_bytes32 = address_to_bytes32(validated_args.recipient)

            try:
                decimals = get_token_decimals(wallet_provider, token_address)
                amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)
            except Exception as e:
                return f"Error reading token info for {validated_args.token_address}: {e!s}"

            try:
                wallet_balance = get_token_balance(wallet_provider, token_address)
                if wallet_balance < amount_atomic:
                    human_balance = format_amount_from_decimals(wallet_balance, decimals)
                    return (
                        f"Error: Insufficient balance. Wallet has {human_balance} of token "
                        f"{validated_args.token_address}, but trying to send {validated_args.amount}"
                    )
            except Exception as e:
                return f"Error checking token balance: {e!s}"

            warp_contract = Web3().eth.contract(address=warp_route, abi=WARP_ROUTE_ABI)

            try:
                interchain_gas = wallet_provider.read_contract(
                    contract_address=warp_route,
                    abi=WARP_ROUTE_ABI,
                    function_name="quoteGasPayment",
                    args=[domain],
                )
            except Exception as e:
                return f"Error quoting interchain gas payment: {e!s}"

            try:
                _ = approve_token(wallet_provider, token_address, warp_route, amount_atomic)
            except Exception as e:
                return f"Error approving Warp Route to spend token: {e!s}"

            encoded_data = warp_contract.encode_abi(
                "transferRemote",
                args=[domain, recipient_bytes32, amount_atomic],
            )

            params = {
                "to": warp_route,
                "data": encoded_data,
                "value": interchain_gas,
            }

            try:
                tx_hash = wallet_provider.send_transaction(params)
                wallet_provider.wait_for_transaction_receipt(tx_hash)
            except Exception as e:
                return f"Error executing transferRemote: {e!s}"

            try:
                token_symbol = get_token_symbol(wallet_provider, token_address)
            except Exception:
                token_symbol = "tokens"

            return (
                f"Successfully dispatched {validated_args.amount} {token_symbol} via Hyperlane "
                f"Warp Route {warp_route} to {validated_args.recipient} on "
                f"{validated_args.destination} (domain {domain}).\n"
                f"Transaction hash: {tx_hash}\n"
                f"Interchain gas paid: {interchain_gas} wei"
            )
        except Exception as e:
            return f"Error sending Hyperlane transfer: {e!s}"

    @create_action(
        name="quote_transfer_remote",
        description="""
This tool previews the interchain gas payment required for a Hyperlane Warp Route transfer.
It takes:
- warp_route_address: Address of the Hyperlane Warp Route (TokenRouter) on the current chain
- destination: Destination chain name (e.g. `ethereum`, `optimism`, `arbitrum`, `base`, `polygon`, `bsc`)

Returns the gas payment in wei that must be sent as msg.value to a subsequent transferRemote call to that destination.
""",
        schema=HyperlaneQuoteGasSchema,
    )
    def quote_transfer_remote(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Quote the interchain gas payment for a Warp Route transfer.

        Args:
            wallet_provider: The wallet to read from.
            args: The quote parameters.

        Returns:
            str: A message containing the quoted gas payment.

        """
        try:
            validated_args = HyperlaneQuoteGasSchema(**args)
            network = wallet_provider.get_network()

            if not self.supports_network(network):
                return (
                    f"Error: Network {network.network_id} is not a supported "
                    f"Hyperlane origin chain"
                )

            try:
                domain = self._get_destination_domain(validated_args.destination)
            except ValueError as e:
                return f"Error: {e!s}"

            warp_route = Web3.to_checksum_address(validated_args.warp_route_address)

            try:
                interchain_gas = wallet_provider.read_contract(
                    contract_address=warp_route,
                    abi=WARP_ROUTE_ABI,
                    function_name="quoteGasPayment",
                    args=[domain],
                )
            except Exception as e:
                return f"Error quoting interchain gas payment: {e!s}"

            return (
                f"Hyperlane Warp Route {warp_route} quotes {interchain_gas} wei "
                f"for a transfer to {validated_args.destination} (domain {domain})."
            )
        except Exception as e:
            return f"Error quoting Hyperlane transfer: {e!s}"


def hyperlane_action_provider() -> HyperlaneActionProvider:
    """Create a new HyperlaneActionProvider instance.

    Returns:
        HyperlaneActionProvider: A new instance of the Hyperlane action provider.

    """
    return HyperlaneActionProvider()
