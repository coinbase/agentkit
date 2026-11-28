"""HelmSwap action provider.

Quotes and executes token swaps on EVM networks through HelmSwap's public API.
HelmSwap returns unsigned transactions; the agent's own wallet provider signs and
sends them. HelmSwap never holds keys and never broadcasts.
"""

from decimal import Decimal
from typing import Any

import requests
from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from ..erc20.constants import ERC20_ABI
from .schemas import ExecuteSwapSchema, GetSwapQuoteSchema

HELMSWAP_API_URL = "https://helmswap.com"
# EVM chain ids where HelmSwap can build swap transactions.
HELMSWAP_SUPPORTED_CHAIN_IDS = ("1", "56", "999", "4663", "5042", "8453", "57073", "99901")
DEFAULT_SLIPPAGE_BPS = 50
NATIVE_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"


class HelmswapActionProvider(ActionProvider[EvmWalletProvider]):
    """Action provider for quoting and executing swaps with HelmSwap."""

    def __init__(self, base_url: str | None = None, timeout: int = 30) -> None:
        """Initialize the HelmSwap action provider.

        Args:
            base_url (str | None): Override the HelmSwap API base URL. Defaults to https://helmswap.com.
            timeout (int): HTTP timeout in seconds.

        """
        super().__init__("helmswap", [])
        self._base_url = (base_url or HELMSWAP_API_URL).rstrip("/")
        self._timeout = timeout

    @create_action(
        name="get_swap_quote_from_helmswap",
        description="""
        This tool gets a swap quote from HelmSwap on the current EVM network without executing anything.

        It takes the following inputs:
        - sell_token: The contract address of the token to sell
        - buy_token: The contract address of the token to buy
        - sell_amount: The amount of sell_token in whole units (e.g. 1 ETH or 10 USDC)
        - slippage_bps: (Optional) Maximum allowed slippage in basis points (default 50, max 1000)

        Important notes:
        - The address for the native asset is "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        - The quote includes a disclosed fee, the expected output, the minimum output after slippage and the price impact
        - Use sell_amount units exactly as provided, do not convert to wei or any other units
        - Never assume token or address, they have to be provided as inputs
        """,
        schema=GetSwapQuoteSchema,
    )
    def get_swap_quote(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get a swap quote from HelmSwap.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider used for the network and token details.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the quote or error details.

        """
        try:
            validated = GetSwapQuoteSchema(**args)
            chain_id = self._chain_id(wallet_provider)
            sell_decimals = self._decimals(wallet_provider, validated.sell_token)
            buy_decimals = self._decimals(wallet_provider, validated.buy_token)
            amount_in = self._to_base_units(validated.sell_amount, sell_decimals)

            quote = self._fetch_quote(chain_id, validated, amount_in)
            inner = quote["quote"]
            impact = quote.get("priceImpact") or {}
            return (
                "HelmSwap quote: sell "
                f"{validated.sell_amount} {validated.sell_token} for about "
                f"{self._from_base_units(inner['netOutAmount'], buy_decimals)} {validated.buy_token} "
                f"(minimum {self._from_base_units(inner['minOutNet'], buy_decimals)} after slippage). "
                f"Disclosed fee: {inner.get('fee')}. "
                f"Price impact: {impact.get('priceImpactPct')}%. "
                f"Buildable: {impact.get('buildable', True)}. "
                f"Warnings: {quote.get('warnings') or []}. "
                "Nothing was executed."
            )
        except Exception as e:
            return f"Error fetching HelmSwap quote: {e!s}"

    @create_action(
        name="execute_swap_on_helmswap",
        description="""
        This tool executes a token swap on the current EVM network using HelmSwap.

        It takes the following inputs:
        - sell_token: The contract address of the token to sell
        - buy_token: The contract address of the token to buy
        - sell_amount: The amount of sell_token in whole units (e.g. 1 ETH or 10 USDC)
        - slippage_bps: (Optional) Maximum allowed slippage in basis points (default 50, max 1000)

        Important notes:
        - The address for the native asset is "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        - This will execute an actual swap transaction that sends tokens from your wallet
        - HelmSwap builds the unsigned transaction; your wallet signs and sends it. A disclosed fee is included in the quote.
        - When selling an ERC-20 token, an approval for the exact sell amount is sent first
        - Ensure you have sufficient balance of the sell token before executing
        - First fetch a quote and only execute the swap if you are happy with the indicated price
        - Use sell_amount units exactly as provided, do not convert to wei or any other units
        - Never assume token or address, they have to be provided as inputs
        """,
        schema=ExecuteSwapSchema,
    )
    def execute_swap(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Execute a swap through HelmSwap using the agent's own wallet.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider that signs and sends the transactions.
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the transaction details or error details.

        """
        approval_hashes: list[str] = []
        try:
            validated = ExecuteSwapSchema(**args)
            chain_id = self._chain_id(wallet_provider)
            sell_decimals = self._decimals(wallet_provider, validated.sell_token)
            buy_decimals = self._decimals(wallet_provider, validated.buy_token)
            amount_in = self._to_base_units(validated.sell_amount, sell_decimals)

            quote = self._fetch_quote(chain_id, validated, amount_in)
            impact = quote.get("priceImpact") or {}
            if impact.get("buildable") is False:
                return (
                    "Error: HelmSwap will not build this swap because the price impact is too high "
                    f"({impact.get('priceImpactPct')}%). Try a smaller amount."
                )

            built = self._request(
                "POST",
                "/api/v1/build-tx",
                json={
                    "chainId": int(chain_id),
                    "tokenIn": validated.sell_token,
                    "tokenOut": validated.buy_token,
                    "amountIn": amount_in,
                    "recipient": wallet_provider.get_address(),
                    "quoteTicket": quote["quoteTicket"],
                    "slippageBps": validated.slippage_bps
                    if validated.slippage_bps is not None
                    else DEFAULT_SLIPPAGE_BPS,
                },
            )

            for approval in built.get("approvals") or []:
                approval_hash = wallet_provider.send_transaction(self._tx_params(approval))
                wallet_provider.wait_for_transaction_receipt(approval_hash)
                approval_hashes.append(approval_hash)

            tx_hash = wallet_provider.send_transaction(self._tx_params(built["tx"]))
            receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)
            if receipt.get("status") != 1:
                return f"Error: HelmSwap swap transaction failed. Transaction hash: {tx_hash}"

            inner = quote["quote"]
            return (
                f"Swapped {validated.sell_amount} {validated.sell_token} for {validated.buy_token} via HelmSwap. "
                f"Expected about {self._from_base_units(inner['netOutAmount'], buy_decimals)} "
                f"(minimum {self._from_base_units(inner['minOutNet'], buy_decimals)}). "
                f"Disclosed fee: {built.get('fee') or inner.get('fee')}. "
                f"Approval transactions: {approval_hashes}. Swap transaction hash: {tx_hash}."
            )
        except Exception as e:
            suffix = (
                f" Approval transactions already sent: {approval_hashes}."
                if approval_hashes
                else ""
            )
            return f"Error executing HelmSwap swap: {e!s}.{suffix}"

    def supports_network(self, network: Network) -> bool:
        """Check if HelmSwap can build swaps on the given network.

        Args:
            network (Network): The network to check.

        Returns:
            bool: True if the network is a supported EVM network.

        """
        return (
            network.protocol_family == "evm"
            and network.chain_id is not None
            and str(network.chain_id) in HELMSWAP_SUPPORTED_CHAIN_IDS
        )

    @staticmethod
    def _chain_id(wallet_provider: EvmWalletProvider) -> str:
        chain_id = wallet_provider.get_network().chain_id
        if not chain_id:
            raise ValueError("Chain ID not available from wallet provider")
        return str(chain_id)

    @staticmethod
    def _decimals(wallet_provider: EvmWalletProvider, token: str) -> int:
        if token.lower() == NATIVE_TOKEN:
            return 18
        return int(
            wallet_provider.read_contract(
                contract_address=Web3.to_checksum_address(token),
                abi=ERC20_ABI,
                function_name="decimals",
                args=[],
            )
        )

    @staticmethod
    def _to_base_units(amount: str, decimals: int) -> str:
        units = int(Decimal(amount) * (10**decimals))
        if units <= 0:
            raise ValueError("sell_amount is too small for this token's decimals")
        return str(units)

    @staticmethod
    def _from_base_units(raw: str, decimals: int) -> str:
        return format(Decimal(int(raw)) / (10**decimals), "f")

    @staticmethod
    def _tx_params(tx: dict[str, Any]) -> dict[str, Any]:
        params: dict[str, Any] = {"to": Web3.to_checksum_address(tx["to"]), "data": tx["data"]}
        value = tx.get("value")
        params["value"] = int(value, 0) if isinstance(value, str) else int(value or 0)
        return params

    def _fetch_quote(
        self, chain_id: str, args: GetSwapQuoteSchema, amount_in: str
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "/api/v1/quote",
            params={
                "chainId": chain_id,
                "tokenIn": args.sell_token,
                "tokenOut": args.buy_token,
                "amountIn": amount_in,
                "slippageBps": str(
                    args.slippage_bps if args.slippage_bps is not None else DEFAULT_SLIPPAGE_BPS
                ),
            },
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        response = requests.request(
            method,
            f"{self._base_url}{path}",
            headers={"Accept": "application/json"},
            timeout=self._timeout,
            **kwargs,
        )
        try:
            payload = response.json()
        except ValueError as err:
            raise RuntimeError(
                f"HelmSwap returned a non-JSON response ({response.status_code})"
            ) from err
        if not response.ok or not isinstance(payload, dict) or payload.get("ok") is False:
            message = payload.get("error") if isinstance(payload, dict) else None
            raise RuntimeError(message or f"HelmSwap request failed ({response.status_code})")
        return payload


def helmswap_action_provider(
    base_url: str | None = None, timeout: int = 30
) -> HelmswapActionProvider:
    """Create a new instance of the HelmswapActionProvider.

    Args:
        base_url (str | None): Override the HelmSwap API base URL. Defaults to https://helmswap.com.
        timeout (int): HTTP timeout in seconds.

    Returns:
        HelmswapActionProvider: A new instance of the action provider.

    """
    return HelmswapActionProvider(base_url=base_url, timeout=timeout)
