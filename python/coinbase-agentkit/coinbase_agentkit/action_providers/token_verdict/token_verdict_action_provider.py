"""Token Verdict action provider."""

import json
from typing import Any

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import TokenVerdictSchema
from .utils import TokenVerdictOptions, fetch_token_verdict

TOKEN_VERDICT_DESCRIPTION = """
This tool will get a risk verdict for a token before buying, swapping, or routing funds into it.

It calls Token Verdict, a live x402 service, and pays $0.02 USDC on Base automatically
from the agent wallet. It returns a verdict (SOLID / CAUTION / DANGER) with a 0-100 score,
six weighted market-structure signals (liquidity depth, volume churn, sell pressure,
price action, trader breadth, pair age), a written analyst take, and the raw market data.

Inputs:
- address: The token contract address (0x...)
- chain: Which token market to analyze - "base" (default), "ethereum", or "solana".
  Payment always settles in USDC on Base, whichever chain's token is analyzed.

Example input:
{"address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "chain": "base"}

Use this when about to interact with a token whose market quality is unknown. If you are
unsure of the token contract address, please ask the user before proceeding.
"""


class TokenVerdictActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides a typed token risk verdict action backed by the Token Verdict x402 service.

    This provider complements AgentKit's generic x402 action provider: the
    generic provider is a general-purpose rail for calling any x402
    endpoint, while this one is a dedicated, typed action for a single
    service, with the service's real request contract as its schema and a
    spend guard pinned to the service's known price.
    """

    def __init__(self, options: TokenVerdictOptions | None = None):
        """Initialize the Token Verdict action provider.

        Args:
            options: Optional provider options (service URL, spend-guard
                cap, session override).

        """
        super().__init__("token-verdict", [])
        self._options = options or TokenVerdictOptions()

    # create_action is untyped in action_decorator, as for every provider.
    @create_action(  # type: ignore[misc]
        name="token_verdict",
        description=TOKEN_VERDICT_DESCRIPTION,
        schema=TokenVerdictSchema,
    )
    def token_verdict(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get a risk verdict for a token from the Token Verdict service.

        Pays the service's $0.02 USDC x402 charge on Base from the agent
        wallet and returns the verdict as JSON. Errors are returned as an
        error string rather than raised, matching the TypeScript provider.

        Args:
            wallet_provider: The EVM wallet provider that pays for the call.
            args: The action arguments (address, chain).

        Returns:
            The verdict JSON on success, or an error string on failure.

        """
        try:
            params = TokenVerdictSchema(**args)
            verdict = fetch_token_verdict(wallet_provider.to_signer(), params, self._options)
            return json.dumps(verdict, indent=2)
        except Exception as e:
            return f"Error getting token verdict: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by Token Verdict actions.

        Payment settles in USDC on Base, so the wallet must be an EVM
        wallet on Base mainnet.

        Args:
            network: The network to check.

        Returns:
            bool: True if the network is Base mainnet.

        """
        return network.protocol_family == "evm" and (
            network.chain_id == "8453" or network.network_id == "base-mainnet"
        )


def token_verdict_action_provider(
    options: TokenVerdictOptions | None = None,
) -> TokenVerdictActionProvider:
    """Create a new Token Verdict action provider.

    Args:
        options: Optional provider options (service URL, spend-guard cap,
            session override).

    Returns:
        A new TokenVerdictActionProvider instance.

    """
    return TokenVerdictActionProvider(options)
