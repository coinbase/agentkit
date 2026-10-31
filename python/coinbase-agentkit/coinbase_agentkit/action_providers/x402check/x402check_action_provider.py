"""X402check action provider."""

import json
import os
from typing import Any

import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import PreflightCheckSchema, VerifyPayToSchema

DEFAULT_BASE_URL = "https://x402check.dev"


class X402checkActionProvider(ActionProvider[WalletProvider]):
    """Trust-preflight x402 seller URLs via https://x402check.dev before paying."""

    def __init__(
        self,
        base_url: str | None = None,
        payment_headers: dict[str, str] | None = None,
    ):
        """Initialize the provider.

        Args:
            base_url: Override API origin (default https://x402check.dev or X402CHECK_URL).
            payment_headers: Optional headers (e.g. PAYMENT-SIGNATURE) for the $0.002 charge.

        """
        super().__init__("x402check", [])
        env_url = os.environ.get("X402CHECK_URL", "").rstrip("/")
        self.base_url = (base_url or env_url or DEFAULT_BASE_URL).rstrip("/")
        self.payment_headers = payment_headers or {}

    def _fetch_preflight(self, seller_url: str, fresh: bool = False) -> dict[str, Any]:
        if os.environ.get("X402CHECK_SKIP") == "1":
            return {
                "url": seller_url,
                "verdict": "ok",
                "reasonCodes": ["preflight_skipped"],
                "history": {"checks": 0},
            }

        params: dict[str, str] = {"url": seller_url}
        if fresh:
            params["fresh"] = "1"

        headers = {"accept": "application/json", **self.payment_headers}
        response = requests.get(
            f"{self.base_url}/preflight",
            params=params,
            headers=headers,
            timeout=30,
        )

        if response.status_code == 402:
            return {
                "success": False,
                "error": "x402check_payment_required",
                "status": 402,
                "hint": (
                    "x402check charges $0.002 USDC Exact on Base (eip155:8453) per check. "
                    "Pass payment_headers with a PAYMENT-SIGNATURE, or use a payment-aware HTTP client."
                ),
            }

        if not response.ok:
            return {
                "success": False,
                "error": f"x402check_http_{response.status_code}",
                "status": response.status_code,
                "body": response.text[:500],
            }

        data = response.json()
        data["success"] = True
        return data

    @staticmethod
    def _format_check(check: dict[str, Any], extras: dict[str, Any] | None = None) -> str:
        if check.get("success") is False and "verdict" not in check:
            return json.dumps(check)

        verdict = check.get("verdict")
        if verdict == "avoid":
            guidance = "Do not pay this seller."
        elif verdict == "caution":
            guidance = "Escalate / require confirmation before paying; still enforce maxAmount."
        else:
            guidance = "Verdict ok — still enforce your maxAmount and allowlist rules."

        payload: dict[str, Any] = {
            "success": True,
            **(extras or {}),
            "url": check.get("url"),
            "verdict": verdict,
            "payTo": check.get("payTo"),
            "priceUsd": check.get("priceUsd"),
            "network": check.get("network"),
            "is402": check.get("is402"),
            "reasonCodes": check.get("reasonCodes") or [],
            "history": check.get("history"),
            "checkedAt": check.get("checkedAt"),
            "live": check.get("live"),
            "guidance": guidance,
        }
        return json.dumps(payload)

    @create_action(
        name="preflight_check",
        description="""Trust-check one absolute https x402 seller URL BEFORE paying it (x402check).

Use when about to settle / sign PAYMENT-SIGNATURE to a third-party x402 tool:
- is this endpoint safe / reachable / presenting a valid 402?
- verify the receiving wallet (payTo) and detect wallet/price drift via history
- uptime and recent probe history for that URL only

Returns verdict ok|caution|avoid + history. If verdict=avoid do NOT pay.
Billed $0.002 USDC Exact on Base per check. Endpoint+history only — not OFAC/simulation.
""",
        schema=PreflightCheckSchema,
    )
    def preflight_check(self, args: dict[str, Any]) -> str:
        """Trust-check one seller URL before paying.

        Args:
            args: Input arguments for the action.

        Returns:
            JSON string with ToolCheck fields and guidance.

        """
        try:
            validated = PreflightCheckSchema(**args)
            check = self._fetch_preflight(validated.url, fresh=bool(validated.fresh))
            return self._format_check(check)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    @create_action(
        name="verify_payto",
        description="""Verify the receiving wallet (payTo) from an x402 seller's live 402 challenge before signing USDC.

Same $0.002 billing as preflight_check. Optionally compare against expected_pay_to.
Deny payment when verdict=avoid. Escalate on caution or payTo mismatch.
""",
        schema=VerifyPayToSchema,
    )
    def verify_payto(self, args: dict[str, Any]) -> str:
        """Verify payTo from a seller's live 402 challenge.

        Args:
            args: Input arguments for the action.

        Returns:
            JSON string focused on payTo + history.

        """
        try:
            validated = VerifyPayToSchema(**args)
            check = self._fetch_preflight(validated.url, fresh=bool(validated.fresh))
            if check.get("success") is False and "verdict" not in check:
                return json.dumps(check)

            expected = (validated.expected_pay_to or "").strip() or None
            pay_to_match = None
            mismatch = None
            live_pay_to = check.get("payTo")
            if expected and live_pay_to:
                pay_to_match = expected.lower() == str(live_pay_to).lower()
                if not pay_to_match:
                    mismatch = f"Live payTo {live_pay_to} does not match expected_pay_to {expected}"
            elif expected and not live_pay_to:
                pay_to_match = False
                mismatch = f"No payTo in live challenge; expected {expected}"

            extras: dict[str, Any] = {
                "action": "verify_payto",
                "expectedPayTo": expected,
                "payToMatch": pay_to_match,
                "payToChanges": (check.get("history") or {}).get("payToChanges") or [],
            }
            if mismatch:
                extras["mismatch"] = mismatch
            return self._format_check(check, extras)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    def supports_network(self, network: Network) -> bool:
        """x402check is network-agnostic."""
        return True


def x402check_action_provider(
    base_url: str | None = None,
    payment_headers: dict[str, str] | None = None,
) -> X402checkActionProvider:
    """Create a new X402check action provider.

    Args:
        base_url: Optional API origin override.
        payment_headers: Optional payment headers for the $0.002 charge.

    Returns:
        X402checkActionProvider instance.

    """
    return X402checkActionProvider(base_url=base_url, payment_headers=payment_headers)
