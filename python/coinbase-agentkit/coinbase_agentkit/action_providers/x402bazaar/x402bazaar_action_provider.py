"""x402 Bazaar action provider."""

from __future__ import annotations

import json
from typing import Any

import requests
from x402 import x402ClientSync
from x402.http.clients.requests import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import API_BASE_URL, CHAIN_ENDPOINTS, SUPPORTED_NETWORKS
from .schemas import TokenVerdictSchema


class X402BazaarActionProvider(ActionProvider[WalletProvider]):
    """Provides a pre-trade token-verdict safety check for Base ERC-20 tokens via x402 Bazaar.

    Returns a SAFE / CAUTION / AVOID / UNKNOWN verdict with confidence, the reasons behind it,
    and a recommended max position size. Uses the free daily tier by default; when payment is
    enabled and an EVM wallet is available it pays $0.03 USDC per call over x402.
    """

    def __init__(self, enable_payment: bool = False):
        """Initialize the x402 Bazaar action provider.

        Args:
            enable_payment: Pay $0.03 USDC/call over x402 using the agent's wallet instead of
                the free daily tier. Requires an EVM wallet on Base. Defaults to False.

        """
        super().__init__("x402bazaar", [])
        self._enable_payment = enable_payment

    @create_action(
        name="token_verdict_check",
        description="""Pre-trade safety check for a Base, Arbitrum or Solana token before buying or approving it.

Returns a SAFE / CAUTION / AVOID / UNKNOWN verdict with a confidence score, a one-line headline,
the reasons behind the verdict, and a recommended maximum position size in USD. Covers honeypot
behavior, sell-tax, mint/freeze/owner powers, LP-lock, holder concentration, and (on Base) B20
freeze/seize controls.

Inputs:
- address: The token to screen — a Base/Arbitrum 0x… address or a Solana base58 mint.
- chain: (optional) 'base' (default), 'arbitrum', or 'solana'. A base58 token implies solana.
- amount_usd: (optional) Intended trade size in USD; tunes the recommended max safe size.

Use this before any action that buys, swaps into, or approves an unfamiliar token.
Powered by x402 Bazaar: a free daily call by default, or $0.03 USDC/call over x402 (settles on
Base for any chain) when payment is enabled.
""",
        schema=TokenVerdictSchema,
    )
    def token_verdict_check(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Run a pre-trade safety check on a Base ERC-20 token.

        Args:
            wallet_provider: The wallet provider, used only when payment is enabled.
            args: Input arguments matching TokenVerdictSchema.

        Returns:
            str: A JSON string containing the verdict or error details.

        """
        try:
            validated_args = TokenVerdictSchema(**args)

            # Default base; a base58 (non-0x) token implies Solana. Every chain's
            # verdict settles in USDC on Base, so the EVM paid path covers all three.
            chain = validated_args.chain or (
                "base" if validated_args.address.startswith("0x") else "solana"
            )
            endpoint, param = CHAIN_ENDPOINTS[chain]
            url = f"{API_BASE_URL}/{endpoint}"

            params: dict[str, str] = {param: validated_args.address}
            if validated_args.amount_usd is not None:
                params["amountUsd"] = str(validated_args.amount_usd)

            if self._enable_payment and isinstance(wallet_provider, EvmWalletProvider):
                client = self._create_x402_client(wallet_provider)
                session = x402_requests(client)
                response = session.get(url, params=params)
            else:
                params["free"] = "1"
                response = requests.get(url, params=params)

            if response.status_code == 402:
                return json.dumps(
                    {
                        "error": True,
                        "message": "Payment required",
                        "details": (
                            "token-verdict requires an x402 payment ($0.03 USDC on Base). Enable "
                            "payment on the provider (enable_payment=True) with a funded EVM wallet, "
                            "or omit it for the free daily call."
                        ),
                    }
                )

            if not response.ok:
                return json.dumps(
                    {
                        "error": True,
                        "message": f"x402 Bazaar request failed with status {response.status_code}",
                        "details": response.text[:500],
                    }
                )

            data = response.json()
            # The free tier wraps the verdict in {"data": ...}; the paid call returns it raw.
            verdict = data.get("data", data) if isinstance(data, dict) else data
            return json.dumps({"success": True, "verdict": verdict})

        except Exception as e:
            return json.dumps(
                {
                    "error": True,
                    "message": "Failed to fetch token verdict from x402 Bazaar",
                    "details": str(e),
                }
            )

    def _create_x402_client(self, wallet_provider: EvmWalletProvider) -> x402ClientSync:
        """Create an x402 client configured for the given EVM wallet provider.

        Args:
            wallet_provider: The EVM wallet provider to sign payments with.

        Returns:
            x402ClientSync: A configured x402 client.

        """
        client = x402ClientSync()
        signer = wallet_provider.to_signer()
        register_exact_evm_client(client, EthAccountSigner(signer))
        return client

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported (Base mainnet only).

        Args:
            network: The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS


def x402bazaar_action_provider(enable_payment: bool = False) -> X402BazaarActionProvider:
    """Create a new x402 Bazaar action provider.

    Args:
        enable_payment: Pay per call over x402 instead of the free tier.

    Returns:
        X402BazaarActionProvider: A new x402 Bazaar action provider instance.

    """
    return X402BazaarActionProvider(enable_payment=enable_payment)
