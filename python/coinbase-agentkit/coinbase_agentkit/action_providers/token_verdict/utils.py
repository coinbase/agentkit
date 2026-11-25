"""Utilities for Token Verdict action provider."""

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import requests
from x402 import x402ClientSync
from x402.client_base import RequirementsView
from x402.http.clients.requests import wrapRequestsWithPayment
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

from ...wallet_providers.evm_wallet_provider import EvmWalletSigner
from .constants import (
    BASE_NETWORK,
    BASE_USDC_ADDRESS,
    TOKEN_VERDICT_BASE_URL,
    TOKEN_VERDICT_PATH,
    TOKEN_VERDICT_PRICE,
    USDC_DECIMALS,
)
from .schemas import TokenVerdictSchema

USD_AMOUNT_PATTERN = re.compile(r"^\$?(\d+)(?:\.(\d+))?$")

# Atomic USDC units per dollar (10 ** USDC_DECIMALS), annotated so the
# exponentiation does not widen to Any under mypy strict.
ATOMIC_PER_DOLLAR: int = 10**USDC_DECIMALS

PaymentPolicy = Callable[[int, list[RequirementsView]], list[RequirementsView]]


@dataclass
class TokenVerdictOptions:
    """Options for the Token Verdict action provider.

    Attributes:
        base_url: Base URL of the Token Verdict service.
        max_amount_per_payment: Spend guard - the maximum USD amount the
            provider will sign for in a single call. Defaults to the
            service's known price, so a repriced or hostile endpoint can
            never silently charge the agent more.
        session: Optional pre-configured requests session (test seam,
            mirroring the TypeScript provider's fetch override).

    """

    base_url: str = TOKEN_VERDICT_BASE_URL
    max_amount_per_payment: str = TOKEN_VERDICT_PRICE
    session: requests.Session | None = None


def usd_to_atomic(amount: str) -> int:
    """Convert a USD amount string (e.g. "$0.02") to USDC atomic units.

    Args:
        amount: The USD amount string to convert.

    Returns:
        The amount in USDC atomic units (6 decimals).

    Raises:
        ValueError: If the amount string is not a valid USD amount.

    """
    match = USD_AMOUNT_PATTERN.match(amount.strip())
    if not match:
        raise ValueError(f"Invalid USD amount: {amount}")

    dollars: str = match.group(1)
    fraction: str = match.group(2) or ""
    if len(fraction) > USDC_DECIMALS:
        raise ValueError(f"USD amount has too many decimal places (max {USDC_DECIMALS}): {amount}")

    return int(dollars) * ATOMIC_PER_DOLLAR + int(fraction.ljust(USDC_DECIMALS, "0") or "0")


def max_amount_policy(max_amount_per_payment: str) -> PaymentPolicy:
    """Build the spend-guard payment policy.

    Mirrors the TypeScript provider's PaymentPolicy: a challenge's payment
    requirements are payable only if they ask for USDC on Base at or under
    the configured cap. Anything else is filtered out before signing, so
    the x402 client refuses instead of paying.

    Args:
        max_amount_per_payment: The maximum USD amount payable per call.

    Returns:
        A payment policy for the x402 client.

    """
    max_atomic = usd_to_atomic(max_amount_per_payment)

    def policy(version: int, options: list[RequirementsView]) -> list[RequirementsView]:
        del version
        return [
            option
            for option in options
            if str(option.network) == BASE_NETWORK
            and option.asset.lower() == BASE_USDC_ADDRESS.lower()
            and int(option.get_amount()) <= max_atomic
        ]

    return policy


def create_paying_session(
    signer: EvmWalletSigner, options: TokenVerdictOptions
) -> requests.Session:
    """Create a requests session that pays x402 challenges automatically.

    Uses the same client stack AgentKit's own x402 action provider
    registers: the wallet provider's signer is bridged through
    EthAccountSigner into the x402 SDK's exact EVM scheme.

    Args:
        signer: The EVM signer from the agent's wallet provider.
        options: The provider options (spend guard, optional session).

    Returns:
        A requests session with the x402 payment adapter mounted.

    """
    client = x402ClientSync()
    # EthAccountSigner is annotated for eth_account's LocalAccount, but it
    # only relies on the BaseAccount surface (address + sign_typed_data)
    # that EvmWalletSigner implements - the same call the repo's x402
    # action provider makes in _create_x402_client.
    register_exact_evm_client(
        client,
        EthAccountSigner(signer),  # type: ignore[arg-type]
        policies=[max_amount_policy(options.max_amount_per_payment)],
    )
    session = options.session or requests.Session()
    return wrapRequestsWithPayment(session, client)


def fetch_token_verdict(
    signer: EvmWalletSigner, args: TokenVerdictSchema, options: TokenVerdictOptions
) -> dict[str, Any]:
    """Call Token Verdict, paying its x402 challenge from the agent wallet.

    Args:
        signer: The EVM signer from the agent's wallet provider.
        args: The validated action arguments.
        options: The provider options.

    Returns:
        The service's verdict response as a dictionary.

    Raises:
        RuntimeError: If the service responds with a non-200 status.

    """
    session = create_paying_session(signer, options)
    response = session.post(
        f"{options.base_url}{TOKEN_VERDICT_PATH}",
        json={"address": args.address, "chain": args.chain},
    )
    if response.status_code != 200:
        body = response.text[:500]
        raise RuntimeError(f"Token Verdict request failed: HTTP {response.status_code}: {body}")

    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError("Token Verdict request failed: response was not a JSON object")
    return data
