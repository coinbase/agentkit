"""Agenda Financial Guard action provider for AgentKit."""

from __future__ import annotations

import json
import math
import re
from typing import Any

import requests

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import CheckTransactionSafetySchema

DEFAULT_GUARD_ENDPOINT = "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/v1/agent-financial/pre-sign-check"

# Legacy local risk denylist, not an authoritative or current sanctions dataset.
LOCAL_RISK_DENYLIST = {
    # Tornado Cash core routers & proxies
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
    "0x722122df12d45b1410ac727761ba7975772da855",
    "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    "0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f",
    "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
    # Lazarus Group / Ronin Bridge exploit destination clusters
    "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
    "0xa0e1c087346358e59675a523171b085c6b308c01",
    "0x53b6936513e738f44fb50d2b9476730c0ab3bfc1",
    # Garantex main deposit & liquidation routing addresses
    "0x61f2382e87903264426543b591b6e4b85c13e488",
    "0x2f389904178ea3c113502280ce42964e7c3a0df4",
}

UNLIMITED_ALLOWANCE_PATTERNS = [
    re.compile(r"ffffffffffffffffffffffffffffffff", re.IGNORECASE),
    re.compile(r"115792089237316195423570985008687907853269984665640564039457584007913129639935"),
]

ADVERSARIAL_INTENT_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+(instructions|rules|limits)", re.IGNORECASE),
    re.compile(r"bypass\s+(compliance|limits|checks|security|guardrails)", re.IGNORECASE),
    re.compile(r"override\s+(policy|system|guard|limit)", re.IGNORECASE),
    re.compile(r"drain\s+(all\s+funds|the\s+wallet|treasury|balance)", re.IGNORECASE),
    re.compile(r"emergency\s+(sweep|drain|withdrawal\s+all)", re.IGNORECASE),
    re.compile(r"send\s+all\s+(funds|balance|usdc|eth)", re.IGNORECASE),
]


class AgendaGuardActionProvider(ActionProvider[WalletProvider]):
    """Review supplied pre-sign evidence without authorizing wallet operations."""

    def __init__(
        self,
        endpoint: str | None = DEFAULT_GUARD_ENDPOINT,
        max_single_limit_usd: float = 1000.0,
        daily_velocity_limit_usd: float = 5000.0,
        timeout_seconds: float = 5.0,
    ) -> None:
        super().__init__("agenda_guard", [])
        for name, value in {
            "max_single_limit_usd": max_single_limit_usd,
            "daily_velocity_limit_usd": daily_velocity_limit_usd,
            "timeout_seconds": timeout_seconds,
        }.items():
            if not math.isfinite(value) or value <= 0:
                raise ValueError(f"{name} must be finite and positive")
        self.endpoint = endpoint
        self.max_single_limit_usd = max_single_limit_usd
        self.daily_velocity_limit_usd = daily_velocity_limit_usd
        self.timeout_seconds = timeout_seconds

    def supports_network(self, network: Network) -> bool:
        """Support EVM evidence only; this action does not sign or send transactions."""
        return network.protocol_family == "evm"

    @create_action(
        name="check_transaction_safety",
        description="""Review proposed EVM transaction evidence before human signing.

Checks a legacy local risk denylist, approval patterns, supplied intent and policy
limits. No current sanctions clearance, authoritative spending ledger, signing
permission or automatic interception. Caller-reported history is unverified.
Returns reject or step_up_human_required; is_safe is always false. HTTP errors,
payment-required responses and malformed remote results never authorize execution.
Use structured recipient, amount_usd, network, token, calldata and intent fields.
""",
        schema=CheckTransactionSafetySchema,
    )
    def check_transaction_safety(self, args: dict[str, Any]) -> str:
        """Return evidence findings; applications must enforce the review boundary."""
        validated = CheckTransactionSafetySchema(**args)
        recipient = validated.recipient.strip().lower()
        calldata = validated.calldata.strip().lower()
        violations = []
        denied = recipient in LOCAL_RISK_DENYLIST
        unlimited = calldata.startswith("0x095ea7b3") and any(
            pattern.search(calldata) for pattern in UNLIMITED_ALLOWANCE_PATTERNS
        )
        suspicious_intent = any(
            pattern.search(validated.intent) for pattern in ADVERSARIAL_INTENT_PATTERNS
        )
        single_limit = validated.amount_usd <= self.max_single_limit_usd
        history = validated.velocity_24h_usd
        reported_daily_limit = (
            history + validated.amount_usd <= self.daily_velocity_limit_usd
            if history is not None
            else None
        )
        if denied:
            violations.append(
                "Recipient matches a legacy local risk denylist; current sanctions status is unverified."
            )
        if unlimited:
            violations.append("Infinite token approval pattern detected in supplied calldata.")
        if suspicious_intent:
            violations.append("Suspicious prompt injection pattern in supplied intent.")
        if not single_limit:
            violations.append(
                "Caller-reported amount exceeds the configured single-transaction limit."
            )
        if reported_daily_limit is False:
            violations.append(
                "Caller-reported history plus amount exceeds the configured daily limit."
            )
        checks = {
            "local_risk_denylist": not denied,
            "sanctions_aml": False,
            "contract_security": not unlimited,
            "single_transaction_limit": single_limit,
            "reported_daily_limit": reported_daily_limit,
            "velocity_limits": False,
            "prompt_injection": not suspicious_intent,
        }
        decision = (
            "reject" if denied or unlimited or suspicious_intent else "step_up_human_required"
        )
        remote_status = "not_requested"
        if self.endpoint and decision != "reject":
            policy = {
                "max_single_limit_usd": self.max_single_limit_usd,
                "daily_velocity_limit_usd": self.daily_velocity_limit_usd,
            }
            if history is not None:
                policy["velocity_24h_usd"] = history
            payload = {
                "run_id": f"agentkit_{recipient[:8]}",
                "agent": {
                    "id": "coinbase-agentkit",
                    "model": "agentkit-action-provider",
                    "operator": "human_review",
                },
                "transaction": {
                    "network": validated.network,
                    "token": validated.token,
                    "amount_usd": validated.amount_usd,
                    "recipient": recipient,
                    "method": "approve" if calldata.startswith("0x095ea7b3") else "transfer",
                    "calldata": calldata,
                },
                "intent": {"prompt": validated.intent},
                "policy_limits": policy,
            }
            try:
                response = requests.post(
                    self.endpoint, json=payload, timeout=self.timeout_seconds, allow_redirects=False
                )
                if response.status_code != 200:
                    remote_status = (
                        "payment_required" if response.status_code == 402 else "http_error"
                    )
                else:
                    body = response.json()
                    verdict = (
                        body.get("financial_guard_verdict") if isinstance(body, dict) else None
                    )
                    remote_decision = verdict.get("decision") if isinstance(verdict, dict) else None
                    if remote_decision in {"allow", "reject", "step_up_human_required"}:
                        remote_status = "evaluated"
                        if remote_decision == "reject":
                            decision = "reject"
                            violations.append(
                                "Remote evidence gate rejected the supplied proposal."
                            )
                    else:
                        remote_status = "invalid_response"
            except (requests.RequestException, ValueError, TypeError):
                remote_status = "unavailable_or_invalid"
        return json.dumps(
            {
                "is_safe": False,
                "is_blocked": decision == "reject",
                "human_review_required": decision != "reject",
                "decision": decision,
                "risk_score": 95 if decision == "reject" else 55,
                "advisory": "Do not sign or broadcast. Review the actual transaction, current screening and wallet ledger.",
                "violations": violations,
                "checks": checks,
                "evaluated_by": "local_evidence_review",
                "remote_status": remote_status,
                "history_verified": False,
            },
            indent=2,
        )


def agenda_guard_action_provider(
    endpoint: str | None = DEFAULT_GUARD_ENDPOINT,
    max_single_limit_usd: float = 1000.0,
    daily_velocity_limit_usd: float = 5000.0,
    timeout_seconds: float = 5.0,
) -> AgendaGuardActionProvider:
    """Create the optional evidence-review provider without wallet interception."""
    return AgendaGuardActionProvider(
        endpoint=endpoint,
        max_single_limit_usd=max_single_limit_usd,
        daily_velocity_limit_usd=daily_velocity_limit_usd,
        timeout_seconds=timeout_seconds,
    )
