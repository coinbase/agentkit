"""WalletForge x402 action provider.

Community action provider for pay-per-call WalletForge tools on Base via x402 V2:
- fetch_markdown (0.05 USDC)
- normalize_text (0.01 USDC)

Mirrors the published ``walletforge-x402`` buyer
(https://github.com/mig26-design/walletforge-x402). Callers may inject that
package's ``X402Buyer`` via ``buyer=``; otherwise this provider uses an in-tree
client (requests + eth-account) and signs with the AgentKit wallet or
``BUYER_PRIVATE_KEY``.
"""

from __future__ import annotations

import json
import os
from typing import Any

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .client import WalletForgeClient, WalletForgeX402Error
from .constants import SUPPORTED_CHAIN_IDS, SUPPORTED_NETWORK_IDS
from .schemas import FetchMarkdownSchema, NormalizeTextSchema


class WalletForgeActionProvider(ActionProvider[WalletProvider]):
    """Provides WalletForge x402 fetch_markdown and normalize_text actions."""

    def __init__(
        self,
        buyer: Any | None = None,
        private_key: str | None = None,
        base_url: str | None = None,
    ):
        """Initialize the WalletForge action provider.

        Args:
            buyer: Optional pre-built buyer (``WalletForgeClient`` or
                ``walletforge_x402.X402Buyer``). If omitted, a client is created
                from ``private_key`` / ``BUYER_PRIVATE_KEY`` or the AgentKit
                wallet provider at invocation time.
            private_key: Optional hex EOA key for EIP-3009. Prefer the AgentKit
                wallet when possible. Never log this value.
            base_url: WalletForge API base URL. Defaults to
                ``X402_BASE_URL`` or ``https://api.walletforge.app``.

        """
        super().__init__("walletforge", [])
        self._base_url = base_url or os.getenv("X402_BASE_URL")
        if buyer is not None:
            self._buyer = buyer
        elif private_key:
            # Convert immediately so the raw key is not retained on the provider.
            self._buyer = WalletForgeClient.from_private_key(private_key, base_url=self._base_url)
        else:
            self._buyer = None

    def _resolve_buyer(self, wallet_provider: WalletProvider | None) -> Any:
        """Return a buyer with ``fetch_markdown`` / ``normalize`` methods."""
        if self._buyer is not None:
            return self._buyer

        key = os.getenv("BUYER_PRIVATE_KEY") or os.getenv("X402_BUYER_PRIVATE_KEY")
        if key:
            self._buyer = WalletForgeClient.from_private_key(key, base_url=self._base_url)
            return self._buyer

        if wallet_provider is not None and hasattr(wallet_provider, "sign_typed_data"):
            return WalletForgeClient.from_wallet(wallet_provider, base_url=self._base_url)

        raise WalletForgeX402Error(
            "No WalletForge signer configured. Use an EVM AgentKit wallet provider "
            "with sign_typed_data, pass private_key=, or set BUYER_PRIVATE_KEY."
        )

    def _format_result(self, resp: Any) -> str:
        """Serialize a paid response for the LLM."""
        data = getattr(resp, "data", resp)
        payment_response = getattr(resp, "payment_response", None)
        payload: dict[str, Any] = {
            "success": True,
            "status_code": getattr(resp, "status_code", 200),
            "data": data,
        }
        if payment_response:
            payload["payment_response"] = payment_response
        return json.dumps(payload, ensure_ascii=False)

    @create_action(
        name="fetch_markdown",
        description="""
This tool fetches a public http(s) URL as cleaned markdown via WalletForge x402 V2.

It settles 0.05 USDC on Base mainnet (eip155:8453) to the WalletForge payTo address
using EIP-3009 TransferWithAuthorization. No seller API key is required.

Inputs:
- url: Public http(s) URL to fetch (required). Private/link-local/metadata hosts are blocked (SSRF-hardened).
- max_chars: Optional markdown character cap (500..200000). Server default is 50000.

Examples:
- fetch_markdown with url "https://example.com"
- fetch_markdown with url "https://example.com" and max_chars 5000

A successful response includes the markdown, title, and optional payment_response (settle tx).
Do not use this tool for private, localhost, or cloud-metadata URLs.
Paid calls spend real Base USDC. Confirm with the user before fetching large batches of URLs.
""",
        schema=FetchMarkdownSchema,
    )
    def fetch_markdown(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Fetch a public URL as markdown via paid x402.

        Args:
            wallet_provider: AgentKit wallet used to sign EIP-3009 if no buyer key is set.
            args: Action arguments matching FetchMarkdownSchema.

        Returns:
            str: JSON string with markdown payload or error details.

        """
        try:
            validated = FetchMarkdownSchema(**args)
            buyer = self._resolve_buyer(wallet_provider)
            resp = buyer.fetch_markdown(validated.url, max_chars=validated.max_chars)
            return self._format_result(resp)
        except Exception as e:
            return json.dumps(
                {
                    "success": False,
                    "error": f"WalletForge fetch_markdown failed: {e!s}",
                }
            )

    @create_action(
        name="normalize_text",
        description="""
This tool normalizes text and extracts emails, URLs, and phone numbers via WalletForge x402 V2.

It settles 0.01 USDC on Base mainnet (eip155:8453) using EIP-3009 TransferWithAuthorization.
No seller API key is required.

Inputs:
- text: The text to normalize (required, 1..200000 characters).

Examples:
- normalize_text with text "Contact us at hello@example.com or https://example.com"

A successful response includes normalized text plus emails, urls, and phones arrays.
Paid calls spend real Base USDC.
""",
        schema=NormalizeTextSchema,
    )
    def normalize_text(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Normalize text via paid x402.

        Args:
            wallet_provider: AgentKit wallet used to sign EIP-3009 if no buyer key is set.
            args: Action arguments matching NormalizeTextSchema.

        Returns:
            str: JSON string with normalized text payload or error details.

        """
        try:
            validated = NormalizeTextSchema(**args)
            buyer = self._resolve_buyer(wallet_provider)
            resp = buyer.normalize(validated.text)
            return self._format_result(resp)
        except Exception as e:
            return json.dumps(
                {
                    "success": False,
                    "error": f"WalletForge normalize_text failed: {e!s}",
                }
            )

    def supports_network(self, network: Network) -> bool:
        """Return True for Base mainnet EVM (WalletForge x402 settlement network).

        Args:
            network: The network to check.

        Returns:
            bool: Whether WalletForge actions should be offered on this network.

        """
        if network.protocol_family != "evm":
            return False
        if network.network_id and network.network_id in SUPPORTED_NETWORK_IDS:
            return True
        return bool(network.chain_id and str(network.chain_id) in SUPPORTED_CHAIN_IDS)


def walletforge_action_provider(
    buyer: Any | None = None,
    private_key: str | None = None,
    base_url: str | None = None,
) -> WalletForgeActionProvider:
    """Create a WalletForge x402 action provider.

    Args:
        buyer: Optional ``walletforge_x402.X402Buyer`` or ``WalletForgeClient``.
        private_key: Optional buyer EOA hex key (or set BUYER_PRIVATE_KEY).
        base_url: Optional API base URL (default https://api.walletforge.app).

    Returns:
        WalletForgeActionProvider: A new WalletForge action provider instance.

    """
    return WalletForgeActionProvider(buyer=buyer, private_key=private_key, base_url=base_url)
