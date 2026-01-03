"""CDP EVM Wallet action provider."""

import asyncio
import json
from typing import Any, TypeVar

from cdp import CdpClient
from web3 import Web3

from ...network import Network
from ...wallet_providers.cdp_evm_wallet_provider import CdpEvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import SwapSchema
from .swap_utils import (
    ERC20_ABI,
    PERMIT2_ADDRESS,
    format_units,
    get_token_details,
    parse_units,
    retry_with_exponential_backoff,
)

TWalletProvider = TypeVar("TWalletProvider", bound=CdpEvmWalletProvider)


class CdpEvmWalletActionProvider(ActionProvider[TWalletProvider]):
    """CdpEvmWalletActionProvider is an action provider for CDP EVM Wallet specific actions.

    This provider is scoped specifically to EVM wallets and provides actions
    that are optimized for EVM functionality, including swap operations.
    """

    def __init__(self):
        """Initialize the CdpEvmWalletActionProvider class."""
        super().__init__("cdp_evm_wallet", [])

    def _get_client(self, wallet_provider: TWalletProvider) -> CdpClient:
        """Get the CDP client from the wallet provider.

        Args:
            wallet_provider: The wallet provider to get the client from.

        Returns:
            CdpClient: The CDP client.

        """
        return wallet_provider.get_client()

    @create_action(
        name="get_swap_price",
        description="""
This tool fetches a price quote for swapping (trading) between two tokens using the CDP Swap API but does not execute a swap.
It takes the following inputs:
- from_token: The contract address of the token to sell
- to_token: The contract address of the token to buy
- from_amount: The amount of fromToken to swap in whole units (e.g. 1 ETH or 10.5 USDC)
- slippage_bps: (Optional) Maximum allowed slippage in basis points (100 = 1%)
Important notes:
- The contract address for native ETH is "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
- Use from_amount units exactly as provided, do not convert to wei or any other units.
""",
        schema=SwapSchema,
    )
    def get_swap_price(self, wallet_provider: TWalletProvider, args: dict[str, Any]) -> str:
        """Get a price quote for swapping tokens using the CDP Swap API.

        Args:
            wallet_provider: The EVM wallet provider to get the quote for.
            args: The input arguments for the swap price action.

        Returns:
            A JSON string with detailed swap price quote information.

        """
        validated_args = SwapSchema(**args)

        # Get CDP SDK network
        network = wallet_provider.get_network()
        network_id = network.network_id
        cdp_network = wallet_provider._get_cdp_sdk_network()

        # Check if the network is supported
        if network_id not in ["base-mainnet", "ethereum-mainnet"]:
            return json.dumps(
                {
                    "success": False,
                    "error": "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'.",
                }
            )

        try:
            # Get token details
            token_details = get_token_details(
                wallet_provider, validated_args.from_token, validated_args.to_token
            )

            client = self._get_client(wallet_provider)

            async def _get_swap_price():
                async with client as cdp:
                    return await cdp.evm.get_swap_price(
                        from_token=validated_args.from_token,
                        to_token=validated_args.to_token,
                        from_amount=str(
                            parse_units(
                                validated_args.from_amount, token_details["from_token_decimals"]
                            )
                        ),
                        network=cdp_network,
                        taker=wallet_provider.get_address(),
                    )

            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            swap_price = loop.run_until_complete(_get_swap_price())

            # Format the amounts properly
            to_amount_formatted = format_units(
                swap_price.to_amount, token_details["to_token_decimals"]
            )

            # Calculate price ratios safely
            from_amount_float = float(validated_args.from_amount)
            to_amount_float = float(to_amount_formatted)

            formatted_response = {
                "success": True,
                "fromAmount": validated_args.from_amount,
                "fromTokenName": token_details["from_token_name"],
                "fromToken": validated_args.from_token,
                "toAmount": to_amount_formatted,
                "toTokenName": token_details["to_token_name"],
                "toToken": validated_args.to_token,
                "slippageBps": validated_args.slippage_bps,
                "priceOfBuyTokenInSellToken": str(from_amount_float / to_amount_float)
                if to_amount_float > 0
                else "",
                "priceOfSellTokenInBuyToken": str(to_amount_float / from_amount_float)
                if from_amount_float > 0
                else "",
            }

            return json.dumps(formatted_response)

        except Exception as error:
            return json.dumps({"success": False, "error": f"Error fetching swap price: {error}"})

    @create_action(
        name="swap",
        description="""
This tool executes a token swap (trade) using the CDP Swap API.
It takes the following inputs:
- from_token: The contract address of the token to sell
- to_token: The contract address of the token to buy
- from_amount: The amount of fromToken to swap in whole units (e.g. 1 ETH or 10.5 USDC)
- slippage_bps: (Optional) Maximum allowed slippage in basis points (100 = 1%)
Important notes:
- The contract address for native ETH is "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
- If needed, it will automatically approve the permit2 contract to spend the fromToken
- Use from_amount units exactly as provided, do not convert to wei or any other units.
""",
        schema=SwapSchema,
    )
    def swap(self, wallet_provider: TWalletProvider, args: dict[str, Any]) -> str:
        """Swap tokens using the CDP client.

        Args:
            wallet_provider: The EVM wallet provider to perform the swap with.
            args: The input arguments for the swap action.

        Returns:
            A JSON string with detailed swap execution information.

        """
        validated_args = SwapSchema(**args)

        # Get CDP SDK network
        network = wallet_provider.get_network()
        network_id = network.network_id
        cdp_network = wallet_provider._get_cdp_sdk_network()

        # Check if the network is supported
        if network_id not in ["base-mainnet", "ethereum-mainnet"]:
            return json.dumps(
                {
                    "success": False,
                    "error": "CDP Swap API is currently only supported on 'base-mainnet' or 'ethereum-mainnet'.",
                }
            )

        try:
            # Get token details
            token_details = get_token_details(
                wallet_provider, validated_args.from_token, validated_args.to_token
            )
            from_token_decimals = token_details["from_token_decimals"]
            from_token_name = token_details["from_token_name"]
            to_token_name = token_details["to_token_name"]
            to_token_decimals = token_details["to_token_decimals"]

            client = self._get_client(wallet_provider)

            async def _execute_swap():
                async with client as cdp:
                    # Get the account
                    account = await cdp.evm.get_account(address=wallet_provider.get_address())

                    # Estimate swap price first to check liquidity, token balance and permit2 approval status
                    swap_quote = await account.quote_swap(
                        from_token=validated_args.from_token,
                        to_token=validated_args.to_token,
                        from_amount=str(
                            parse_units(validated_args.from_amount, from_token_decimals)
                        ),
                        network=cdp_network,
                    )

                    # Check if liquidity is available
                    if not swap_quote.liquidity_available:
                        return {
                            "success": False,
                            "error": f"No liquidity available to swap {validated_args.from_amount} {from_token_name} ({validated_args.from_token}) to {to_token_name} ({validated_args.to_token})",
                        }

                    # Check if balance is enough
                    if (
                        hasattr(swap_quote, "issues")
                        and swap_quote.issues
                        and hasattr(swap_quote.issues, "balance")
                    ):
                        return {
                            "success": False,
                            "error": f"Balance is not enough to perform swap. Required: {validated_args.from_amount} {from_token_name}, but only have {format_units(swap_quote.issues.balance.current_balance, from_token_decimals)} {from_token_name} ({validated_args.from_token})",
                        }

                    # Check if allowance is enough
                    approval_tx_hash = None
                    if (
                        hasattr(swap_quote, "issues")
                        and swap_quote.issues
                        and hasattr(swap_quote.issues, "allowance")
                    ):
                        # Send approval transaction
                        approve_data = (
                            Web3()
                            .eth.contract(abi=ERC20_ABI)
                            .encodeABI(
                                fn_name="approve",
                                args=[PERMIT2_ADDRESS, 2**256 - 1],  # Max uint256
                            )
                        )

                        approval_tx_hash = await cdp.evm.send_transaction(
                            address=wallet_provider.get_address(),
                            transaction={
                                "to": validated_args.from_token,
                                "data": approve_data,
                            },
                            network=cdp_network,
                        )

                        # Wait for approval transaction receipt and check if it was successful
                        receipt = await cdp.evm.wait_for_transaction_receipt(
                            address=wallet_provider.get_address(),
                            transaction_hash=approval_tx_hash,
                            network=cdp_network,
                        )
                        if receipt.status != "success":
                            return {"success": False, "error": "Approval transaction failed"}

                    # Execute swap using the all-in-one pattern with retry logic
                    async def _perform_swap():
                        return await swap_quote.execute()

                    swap_result = await retry_with_exponential_backoff(
                        _perform_swap,
                        max_retries=3,
                        base_delay=5.0,
                    )

                    receipt = await wallet_provider.wait_for_transaction_receipt(
                        swap_result.transaction_hash
                    )

                    # Check if swap was successful
                    if receipt.status != "success":
                        return {"success": False, "error": "Swap transaction reverted"}

                    # Format the successful response
                    formatted_response = {
                        "success": True,
                        "transactionHash": swap_result.transaction_hash,
                        "fromAmount": validated_args.from_amount,
                        "fromTokenName": from_token_name,
                        "fromToken": validated_args.from_token,
                        "toAmount": format_units(swap_quote.to_amount, to_token_decimals),
                        "minToAmount": format_units(swap_quote.min_to_amount, to_token_decimals),
                        "toTokenName": to_token_name,
                        "toToken": validated_args.to_token,
                        "slippageBps": validated_args.slippage_bps,
                        "network": network_id,
                    }

                    if approval_tx_hash:
                        formatted_response["approvalTxHash"] = approval_tx_hash

                    return formatted_response

            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            result = loop.run_until_complete(_execute_swap())
            return json.dumps(result)

        except Exception as error:
            return json.dumps({"success": False, "error": f"Swap failed: {error}"})

    def supports_network(self, network: Network) -> bool:
        """Check if the EVM wallet action provider supports the given network.

        Args:
            network: The network to check.

        Returns:
            True if the EVM wallet action provider supports the network, false otherwise.

        """
        return network.protocol_family == "evm"


def cdp_evm_wallet_action_provider() -> CdpEvmWalletActionProvider:
    """Create a new CDP EVM Wallet action provider.

    Returns:
        CdpEvmWalletActionProvider: A new CDP EVM Wallet action provider instance.

    """
    return CdpEvmWalletActionProvider()
