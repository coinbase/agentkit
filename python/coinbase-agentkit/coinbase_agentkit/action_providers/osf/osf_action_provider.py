"""OSF (Open Source Filings) action provider.

Gives agents paid access to provenance-stamped, public-domain U.S. government and
public-record data over x402 (USDC on Base mainnet): entity resolution, sanctions
screening, and CVE exploitation checks. Every result carries a provenance URL to
its authoritative primary source, so an agent can independently verify each fact.
"""

from __future__ import annotations

import base64
import json
from typing import Any
from urllib.parse import quote

from x402 import max_amount, x402ClientSync
from x402.http.clients.requests import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import CheckCveExploitedSchema, LookupEntitySchema, ScreenEntitySchema

SUPPORTED_NETWORKS = ["base-mainnet"]

DEFAULT_BASE_URL = "https://api.osf-master-server.com/x402"

# Per-call spend ceilings in atomic USDC (6 decimals; 1_000_000 = $1.00). Each
# ceiling sits above OSF's list price so a small price change does not break
# calls, while the max_amount policy refuses to pay more than the ceiling for any
# single call.
_MAX_ENTITY_ATOMIC = 50_000  # $0.05 (list price $0.01)
_MAX_SCREEN_ATOMIC = 150_000  # $0.15 (list price $0.05)
_MAX_CVE_ATOMIC = 100_000  # $0.10 (list price $0.02)

_TIMEOUT_SECONDS = 30


class OsfActionProvider(ActionProvider[EvmWalletProvider]):
    """Action provider for OSF (Open Source Filings) paid public-record data."""

    def __init__(self, base_url: str = DEFAULT_BASE_URL) -> None:
        super().__init__("osf", [])
        self._base_url = base_url.rstrip("/")

    def _paid_get(
        self,
        wallet_provider: EvmWalletProvider,
        path: str,
        max_value_atomic: int,
    ) -> str:
        """Make a single x402-paid GET to an OSF endpoint and return a JSON string.

        Args:
            wallet_provider: The EVM wallet provider that funds the call.
            path: The OSF route path, already URL-encoded, e.g. "/identity/entity/Apple%20Inc".
            max_value_atomic: Maximum the client will pay for this call, in atomic USDC.

        Returns:
            A JSON string with the result and (on success) the on-chain payment proof,
            or a JSON string describing the error.

        """
        try:
            client = x402ClientSync()
            register_exact_evm_client(
                client,
                EthAccountSigner(wallet_provider.to_signer()),
                policies=[max_amount(max_value_atomic)],
            )
            session = x402_requests(client)
            url = f"{self._base_url}{path}"
            response = session.request(method="GET", url=url, timeout=_TIMEOUT_SECONDS)

            # Payment proof header: v2 "payment-response" or v1 "x-payment-response" (base64 JSON).
            payment = None
            proof_header = response.headers.get("payment-response") or response.headers.get(
                "x-payment-response"
            )
            if proof_header:
                try:
                    decoded = json.loads(base64.b64decode(proof_header))
                    payment = {
                        "transaction": decoded.get("transaction"),
                        "network": decoded.get("network"),
                        "payer": decoded.get("payer"),
                    }
                except Exception:
                    payment = None

            is_json = "application/json" in response.headers.get("content-type", "")
            data = response.json() if is_json else response.text

            result: dict[str, Any] = {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "data": data,
            }
            if payment:
                result["payment"] = payment
            return json.dumps(result)
        except Exception as e:
            return json.dumps(
                {
                    "success": False,
                    "error": f"Error calling OSF: {e}",
                    "hint": (
                        "Ensure the wallet holds USDC on Base mainnet and the per-call "
                        "spend ceiling covers the endpoint price."
                    ),
                }
            )

    @create_action(
        name="lookup_entity",
        description="""Resolve and verify a company or person against authoritative public registries, paid per call over x402 (USDC on Base mainnet).

Resolves against US healthcare providers (CMS NPI), global legal entities (GLEIF LEI), US banks (FDIC), and SEC filers / public companies (EDGAR CIK).

Input:
- query: a name, or an identifier (NPI, LEI, FDIC certificate, or CIK) for an exact match.

Returns legal name, status, type, jurisdiction, key identifiers, and a provenance URL to the official source, plus the on-chain payment proof. Use for KYC, KYB, counterparty due-diligence, provider verification, and onboarding.""",
        schema=LookupEntitySchema,
    )
    def lookup_entity(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Resolve an entity by name or identifier against public registries."""
        validated = LookupEntitySchema(**args)
        path = f"/identity/entity/{quote(validated.query, safe='')}"
        return self._paid_get(wallet_provider, path, _MAX_ENTITY_ATOMIC)

    @create_action(
        name="screen_entity",
        description="""Screen a name against the OFAC SDN, EU consolidated, and UK OFSI sanctions lists, paid per call over x402 (USDC on Base mainnet).

Input:
- name: the name to screen.

Returns hit or no-hit, the matched list, a provenance URL, and an audit receipt, plus the on-chain payment proof. Use for AML, KYC, watchlist, and OFAC compliance checks before moving funds or onboarding a counterparty.""",
        schema=ScreenEntitySchema,
    )
    def screen_entity(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Screen a name against OFAC, EU, and UK sanctions lists."""
        validated = ScreenEntitySchema(**args)
        path = f"/screen/sanctions/{quote(validated.name, safe='')}"
        return self._paid_get(wallet_provider, path, _MAX_SCREEN_ATOMIC)

    @create_action(
        name="check_cve_exploited",
        description="""Check whether a CVE is being actively exploited in the wild, paid per call over x402 (USDC on Base mainnet).

Input:
- cve_id: the CVE identifier, e.g. CVE-2021-44228.

Returns its presence on the US CISA Known Exploited Vulnerabilities (KEV) catalog, its EPSS exploit-probability score, and its CVSS severity, each with a provenance URL to the authoritative US government source, plus the on-chain payment proof. Use for vulnerability management, patch prioritization, and DevSecOps triage.""",
        schema=CheckCveExploitedSchema,
    )
    def check_cve_exploited(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Check whether a CVE is on CISA KEV, plus its EPSS and CVSS scores."""
        validated = CheckCveExploitedSchema(**args)
        path = f"/security/cve/{quote(validated.cve_id, safe='')}"
        return self._paid_get(wallet_provider, path, _MAX_CVE_ATOMIC)

    def supports_network(self, network: Network) -> bool:
        """Check whether the network is supported. OSF settles on Base mainnet only.

        Args:
            network: The network to check.

        Returns:
            True if the network is Base mainnet, otherwise False.

        """
        return network.network_id in SUPPORTED_NETWORKS


def osf_action_provider(base_url: str = DEFAULT_BASE_URL) -> OsfActionProvider:
    """Create a new OSF action provider.

    Args:
        base_url: Override the OSF base URL (defaults to the public mainnet API).

    Returns:
        A new OSF action provider instance.

    """
    return OsfActionProvider(base_url=base_url)
