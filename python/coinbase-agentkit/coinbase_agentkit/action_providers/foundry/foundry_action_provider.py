"""Foundry action provider."""

import json
import os
from typing import Any

import requests
from x402 import x402ClientSync
from x402.http.clients.requests import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import CallFoundryToolSchema, ListFoundryToolsSchema

DEFAULT_BASE_URL = "https://minty-sprout.onrender.com"
DEFAULT_MAX_PAYMENT_USDC = 0.05


class FoundryActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for Foundry, a catalog of pay-per-call agent tools paid in USDC over x402.

    Tools cover onchain reads (contract facts, transaction explanations, token info),
    web and network utilities (DNS, WHOIS, SSL, page metadata), and document tools (OCR,
    translation, summaries). Each call costs $0.001 to $0.10 in USDC on Base, and failed
    calls are not charged.
    """

    def __init__(self, base_url: str | None = None, max_payment_usdc: float | None = None):
        """Initialize the Foundry action provider.

        Args:
            base_url: Foundry server URL. Defaults to FOUNDRY_BASE_URL or the public server.
            max_payment_usdc: Maximum USDC to pay per call. Defaults to FOUNDRY_MAX_PAYMENT_USDC or 0.05.

        """
        super().__init__("foundry", [])
        self._base_url = (base_url or os.getenv("FOUNDRY_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self._max_payment_usdc = (
            max_payment_usdc
            if max_payment_usdc is not None
            else float(os.getenv("FOUNDRY_MAX_PAYMENT_USDC", DEFAULT_MAX_PAYMENT_USDC))
        )
        self._tools: dict[str, dict[str, Any]] | None = None

    @create_action(
        name="list_foundry_tools",
        description="""
List the pay-per-call tools available on Foundry, with each tool's id, price in USDC and expected input.
Listing is free. Use it before call_foundry_tool to pick a tool and see what input it takes.

Optionally pass a keyword to filter, e.g. 'contract', 'transaction', 'ocr', 'dns', 'ssl', 'translate'.""",
        schema=ListFoundryToolsSchema,
    )
    def list_foundry_tools(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """List Foundry tools, optionally filtered by keyword.

        Args:
            wallet_provider: The wallet provider (not used for listing).
            args: Optional keyword filter.

        Returns:
            str: JSON string with the matching tools or error details.

        """
        try:
            validated_args = ListFoundryToolsSchema(**args)
            tools = self._load_tools()
            keyword = (validated_args.keyword or "").lower()
            matches = [
                tool
                for tool in tools.values()
                if not keyword
                or keyword in tool["id"]
                or keyword in tool["description"].lower()
                or any(keyword in tag for tag in tool["tags"])
            ]
            return json.dumps(
                {
                    "success": True,
                    "tools": [self._summary(t) for t in matches],
                    "total": len(tools),
                },
                indent=2,
            )
        except Exception as error:
            return json.dumps(
                {"error": True, "message": "Failed to list Foundry tools", "details": str(error)},
                indent=2,
            )

    @create_action(
        name="call_foundry_tool",
        description="""
Call a Foundry tool and pay for it in USDC over x402 from the agent's wallet.

Inputs:
- tool: the tool id from list_foundry_tools (e.g. 'contract-facts', 'tx-explain', 'ocr')
- input: the tool's input string (e.g. a contract address, tx hash, URL, or text)

The tool's price is checked against the configured per-call limit before anything is signed,
and failed calls are not charged. Tell the user the tool's price before calling it.""",
        schema=CallFoundryToolSchema,
    )
    def call_foundry_tool(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Call a Foundry tool, paying with x402.

        Args:
            wallet_provider: The wallet provider used to sign the payment.
            args: The tool id and its input.

        Returns:
            str: JSON string with the tool result or error details.

        """
        try:
            validated_args = CallFoundryToolSchema(**args)
            tool = self._load_tools().get(validated_args.tool)
            if tool is None:
                return json.dumps(
                    {
                        "error": True,
                        "message": "Unknown tool",
                        "details": f'No Foundry tool named "{validated_args.tool}". Use list_foundry_tools to see the available ids.',
                    },
                    indent=2,
                )
            if tool["price_usdc"] > self._max_payment_usdc:
                return json.dumps(
                    {
                        "error": True,
                        "message": "Payment exceeds limit",
                        "details": f"{tool['id']} costs {tool['price_usdc']} USDC, above the limit of {self._max_payment_usdc} USDC.",
                    },
                    indent=2,
                )

            client = x402ClientSync()
            register_exact_evm_client(client, EthAccountSigner(wallet_provider.to_signer()))
            response = x402_requests(client).post(
                self._base_url + tool["path"],
                json={"input": validated_args.input},
                timeout=120,
            )
            try:
                data = response.json()
            except ValueError:
                data = response.text
            if response.status_code != 200:
                return json.dumps(
                    {
                        "error": True,
                        "message": f"Foundry returned status {response.status_code}. Payment was not settled.",
                        "details": data,
                    },
                    indent=2,
                )
            return json.dumps(
                {
                    "success": True,
                    "tool": tool["id"],
                    "price_usdc": tool["price_usdc"],
                    "result": data,
                    "payment_response": response.headers.get("payment-response"),
                },
                indent=2,
            )
        except Exception as error:
            return json.dumps(
                {"error": True, "message": "Failed to call Foundry tool", "details": str(error)},
                indent=2,
            )

    def supports_network(self, network: Network) -> bool:
        """Foundry is paid in USDC on Base mainnet.

        Args:
            network: The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm" and network.network_id == "base-mainnet"

    def _load_tools(self) -> dict[str, dict[str, Any]]:
        """Fetch and cache the tool catalog from Foundry's OpenAPI document."""
        if self._tools is None:
            response = requests.get(self._base_url + "/openapi.json", timeout=30)
            response.raise_for_status()
            tools = {}
            for path, ops in response.json().get("paths", {}).items():
                op = ops.get("post")
                if not op or not path.startswith("/v1/"):
                    continue
                price = op.get("x-payment-info", {}).get("price", {}).get("amount")
                if price is None:
                    continue
                schema = (
                    op.get("requestBody", {})
                    .get("content", {})
                    .get("application/json", {})
                    .get("schema", {})
                )
                tools[path.removeprefix("/v1/")] = {
                    "id": path.removeprefix("/v1/"),
                    "path": path,
                    "price_usdc": float(price),
                    "description": op.get("description") or op.get("summary", ""),
                    "input": schema.get("properties", {}).get("input", {}).get("description", ""),
                    "tags": [t.lower() for t in op.get("tags", [])],
                }
            self._tools = tools
        return self._tools

    @staticmethod
    def _summary(tool: dict[str, Any]) -> dict[str, Any]:
        """Return the fields an agent needs to choose and call a tool."""
        return {
            "id": tool["id"],
            "price_usdc": tool["price_usdc"],
            "description": tool["description"],
            "input": tool["input"],
        }


def foundry_action_provider(
    base_url: str | None = None, max_payment_usdc: float | None = None
) -> FoundryActionProvider:
    """Create a new Foundry action provider.

    Args:
        base_url: Foundry server URL. Defaults to FOUNDRY_BASE_URL or the public server.
        max_payment_usdc: Maximum USDC to pay per call. Defaults to FOUNDRY_MAX_PAYMENT_USDC or 0.05.

    Returns:
        FoundryActionProvider: A new Foundry action provider instance.

    """
    return FoundryActionProvider(base_url=base_url, max_payment_usdc=max_payment_usdc)
