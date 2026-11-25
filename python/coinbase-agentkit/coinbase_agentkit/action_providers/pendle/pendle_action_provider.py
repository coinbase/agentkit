"""Pendle V2 action provider for trading Principal Tokens (PT) via the hosted SDK."""

from typing import Any

from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import PENDLE_ROUTER_ADDRESS, SUPPORTED_NETWORKS
from .schemas import (
    PendleMarketInfoSchema,
    PendleSwapPtForTokenSchema,
    PendleSwapTokenForPtSchema,
)
from .utils import (
    approve_token,
    format_amount_from_decimals,
    format_amount_with_decimals,
    get_chain_id_for_network,
    get_token_balance,
    get_token_decimals,
    get_token_symbol,
    pendle_convert,
    pendle_get_market,
)


class PendleActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for trading Pendle V2 PT positions via the hosted SDK."""

    def __init__(self):
        """Initialize the Pendle action provider."""
        super().__init__("pendle", [])

    def supports_network(self, network: Network) -> bool:
        """Check if the current network is supported by Pendle V2.

        Args:
            network: The network to check.

        Returns:
            bool: True if the network is a supported Pendle origin chain.

        """
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS

    def _submit_pendle_route(
        self,
        wallet_provider: EvmWalletProvider,
        sdk_response: dict[str, Any],
    ) -> str:
        """Approve required tokens then submit the route's prepared transaction.

        Args:
            wallet_provider: The wallet to send from.
            sdk_response: The full response object from Pendle's /convert endpoint.

        Returns:
            str: The submitted transaction hash.

        """
        for approval in sdk_response.get("requiredApprovals", []):
            approve_token(
                wallet_provider,
                approval["token"],
                PENDLE_ROUTER_ADDRESS,
                int(approval["amount"]),
            )

        route = sdk_response["routes"][0]
        tx = route["tx"]
        params = {
            "to": Web3.to_checksum_address(tx["to"]),
            "data": tx["data"],
            "value": int(tx.get("value", 0)),
        }

        tx_hash = wallet_provider.send_transaction(params)
        wallet_provider.wait_for_transaction_receipt(tx_hash)
        return tx_hash

    @create_action(
        name="swap_exact_token_for_pt",
        description="""
This tool buys Pendle Principal Tokens (PT) on a Pendle V2 market by spending an
underlying ERC-20 (e.g. USDC, USDT, WETH).

It takes:
- market_address: Address of the Pendle market on the current chain
- token_in_address: Address of the input ERC-20 to spend
- amount: Human-readable amount of token_in to spend (e.g. `100` for 100 USDC)
- slippage: Slippage tolerance as a decimal, default 0.005 (0.5%)

Important notes:
- The wallet must hold enough of token_in to cover the amount.
- PT trades at a discount to the underlying; you receive PT atomic units, not the underlying.
- The Pendle Router is approved to spend token_in before the swap.
- Calldata is fetched from Pendle's hosted SDK at runtime to handle the V2 router's complex routing and aggregator selection.
""",
        schema=PendleSwapTokenForPtSchema,
    )
    def swap_exact_token_for_pt(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Buy Pendle PT with an ERC-20 token.

        Args:
            wallet_provider: The wallet to swap from.
            args: The swap parameters.

        Returns:
            str: A message describing the result of the swap.

        """
        try:
            validated_args = PendleSwapTokenForPtSchema(**args)
            network = wallet_provider.get_network()

            if not self.supports_network(network):
                return f"Error: Network {network.network_id} is not supported by Pendle"

            try:
                chain_id = get_chain_id_for_network(network)
            except ValueError as e:
                return f"Error: {e!s}"

            try:
                market = pendle_get_market(chain_id, validated_args.market_address)
            except Exception as e:
                return f"Error fetching Pendle market {validated_args.market_address}: {e!s}"

            pt_address = market.get("pt", {}).get("address")
            if not pt_address:
                return f"Error: Pendle market {validated_args.market_address} did not return a PT address"

            token_in = Web3.to_checksum_address(validated_args.token_in_address)

            try:
                decimals = get_token_decimals(wallet_provider, token_in)
                amount_atomic = format_amount_with_decimals(validated_args.amount, decimals)
            except Exception as e:
                return f"Error reading token info for {validated_args.token_in_address}: {e!s}"

            try:
                wallet_balance = get_token_balance(wallet_provider, token_in)
                if wallet_balance < amount_atomic:
                    human_balance = format_amount_from_decimals(wallet_balance, decimals)
                    return (
                        f"Error: Insufficient balance. Wallet has {human_balance} of token "
                        f"{validated_args.token_in_address}, but trying to spend {validated_args.amount}"
                    )
            except Exception as e:
                return f"Error checking token balance: {e!s}"

            try:
                sdk_response = pendle_convert(
                    chain_id=chain_id,
                    receiver=wallet_provider.get_address(),
                    slippage=validated_args.slippage,
                    token_in_address=token_in,
                    amount_in_atomic=amount_atomic,
                    token_out_address=pt_address,
                )
            except Exception as e:
                return f"Error fetching swap calldata from Pendle SDK: {e!s}"

            try:
                tx_hash = self._submit_pendle_route(wallet_provider, sdk_response)
            except Exception as e:
                return f"Error executing Pendle swap: {e!s}"

            try:
                token_in_symbol = get_token_symbol(wallet_provider, token_in)
            except Exception:
                token_in_symbol = "tokens"

            market_symbol = market.get("symbol", validated_args.market_address)
            return (
                f"Successfully swapped {validated_args.amount} {token_in_symbol} for PT in "
                f"Pendle market {market_symbol}.\n"
                f"Transaction hash: {tx_hash}"
            )
        except Exception as e:
            return f"Error swapping for PT on Pendle: {e!s}"

    @create_action(
        name="swap_exact_pt_for_token",
        description="""
This tool sells Pendle Principal Tokens (PT) on a Pendle V2 market for an
ERC-20 (e.g. USDC, USDT, WETH).

It takes:
- market_address: Address of the Pendle market on the current chain
- token_out_address: Address of the ERC-20 to receive
- pt_amount: Human-readable amount of PT to sell (e.g. `100`)
- slippage: Slippage tolerance as a decimal, default 0.005 (0.5%)

Important notes:
- The wallet must hold enough PT to cover pt_amount.
- Selling PT before maturity may incur a market discount; selling at/after maturity returns the underlying 1:1 (less fees).
- The Pendle Router is approved to spend PT before the swap.
- Calldata is fetched from Pendle's hosted SDK at runtime.
""",
        schema=PendleSwapPtForTokenSchema,
    )
    def swap_exact_pt_for_token(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Sell Pendle PT for an ERC-20 token.

        Args:
            wallet_provider: The wallet to swap from.
            args: The swap parameters.

        Returns:
            str: A message describing the result of the swap.

        """
        try:
            validated_args = PendleSwapPtForTokenSchema(**args)
            network = wallet_provider.get_network()

            if not self.supports_network(network):
                return f"Error: Network {network.network_id} is not supported by Pendle"

            try:
                chain_id = get_chain_id_for_network(network)
            except ValueError as e:
                return f"Error: {e!s}"

            try:
                market = pendle_get_market(chain_id, validated_args.market_address)
            except Exception as e:
                return f"Error fetching Pendle market {validated_args.market_address}: {e!s}"

            pt_address = market.get("pt", {}).get("address")
            if not pt_address:
                return f"Error: Pendle market {validated_args.market_address} did not return a PT address"

            pt_address = Web3.to_checksum_address(pt_address)
            token_out = Web3.to_checksum_address(validated_args.token_out_address)

            try:
                pt_decimals = get_token_decimals(wallet_provider, pt_address)
                pt_atomic = format_amount_with_decimals(validated_args.pt_amount, pt_decimals)
            except Exception as e:
                return f"Error reading PT decimals: {e!s}"

            try:
                pt_balance = get_token_balance(wallet_provider, pt_address)
                if pt_balance < pt_atomic:
                    human_balance = format_amount_from_decimals(pt_balance, pt_decimals)
                    return (
                        f"Error: Insufficient PT balance. Wallet holds {human_balance} PT, "
                        f"but trying to sell {validated_args.pt_amount}"
                    )
            except Exception as e:
                return f"Error checking PT balance: {e!s}"

            try:
                sdk_response = pendle_convert(
                    chain_id=chain_id,
                    receiver=wallet_provider.get_address(),
                    slippage=validated_args.slippage,
                    token_in_address=pt_address,
                    amount_in_atomic=pt_atomic,
                    token_out_address=token_out,
                )
            except Exception as e:
                return f"Error fetching swap calldata from Pendle SDK: {e!s}"

            try:
                tx_hash = self._submit_pendle_route(wallet_provider, sdk_response)
            except Exception as e:
                return f"Error executing Pendle swap: {e!s}"

            try:
                token_out_symbol = get_token_symbol(wallet_provider, token_out)
            except Exception:
                token_out_symbol = "tokens"

            market_symbol = market.get("symbol", validated_args.market_address)
            return (
                f"Successfully sold {validated_args.pt_amount} PT for {token_out_symbol} "
                f"on Pendle market {market_symbol}.\n"
                f"Transaction hash: {tx_hash}"
            )
        except Exception as e:
            return f"Error selling PT on Pendle: {e!s}"

    @create_action(
        name="get_pendle_market_info",
        description="""
This tool reads metadata for a Pendle V2 market: PT/YT/SY addresses, expiry,
underlying asset, and symbol.

It takes:
- market_address: Address of the Pendle market on the current chain
""",
        schema=PendleMarketInfoSchema,
    )
    def get_pendle_market_info(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Read details of a Pendle market.

        Args:
            wallet_provider: The wallet to read the network from.
            args: The market query parameters.

        Returns:
            str: A markdown summary of the market.

        """
        try:
            validated_args = PendleMarketInfoSchema(**args)
            network = wallet_provider.get_network()

            if not self.supports_network(network):
                return f"Error: Network {network.network_id} is not supported by Pendle"

            try:
                chain_id = get_chain_id_for_network(network)
            except ValueError as e:
                return f"Error: {e!s}"

            try:
                market = pendle_get_market(chain_id, validated_args.market_address)
            except Exception as e:
                return f"Error fetching Pendle market {validated_args.market_address}: {e!s}"

            pt = market.get("pt", {}) or {}
            yt = market.get("yt", {}) or {}
            sy = market.get("sy", {}) or {}
            underlying = market.get("underlyingAsset", {}) or {}

            return (
                f"# Pendle market {market.get('symbol', validated_args.market_address)}\n\n"
                f"- Address: {market.get('address')}\n"
                f"- Expiry: {market.get('expiry')}\n"
                f"- PT: {pt.get('address')} ({pt.get('symbol')})\n"
                f"- YT: {yt.get('address')} ({yt.get('symbol')})\n"
                f"- SY: {sy.get('address')} ({sy.get('symbol')})\n"
                f"- Underlying: {underlying.get('address')} ({underlying.get('symbol')})\n"
            )
        except Exception as e:
            return f"Error reading Pendle market info: {e!s}"


def pendle_action_provider() -> PendleActionProvider:
    """Create a new PendleActionProvider instance.

    Returns:
        PendleActionProvider: A new instance of the Pendle action provider.

    """
    return PendleActionProvider()
