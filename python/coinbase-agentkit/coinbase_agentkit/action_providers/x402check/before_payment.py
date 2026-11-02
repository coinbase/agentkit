"""beforePayment helper that returns the #1454 X402BeforePaymentDecision shape.

Types are defined locally so this works before coinbase/agentkit#1454 merges —
it does not import unmerged symbols from the x402 provider.
"""

from __future__ import annotations

import os
from collections.abc import Awaitable, Callable
from typing import Any, TypedDict

import requests

DEFAULT_BASE_URL = "https://x402check.dev"


class X402BeforePaymentContext(TypedDict, total=False):
    """Context passed to a beforePayment hook (mirrors #1454).

    Required at runtime: ``url``. Remaining fields match #1454's context when
    the x402 provider threads them through.
    """

    url: str
    payTo: str | None
    network: str
    asset: str
    amount: str
    method: str
    paymentRequirements: dict[str, Any] | None
    paymentRequirementsHeader: str | None


class X402BeforePaymentDecision(TypedDict, total=False):
    """Decision returned by a beforePayment hook (exact #1454 shape).

    ``abort`` is required; ``reason`` and ``code`` are optional. No extra
    fields, so #1454's unrecognized-shape fail-closed guard accepts it.
    """

    abort: bool
    reason: str
    code: str


def _resolve_base_url(base_url: str | None) -> str:
    env_url = os.environ.get("X402CHECK_URL", "").rstrip("/")
    return (base_url or env_url or DEFAULT_BASE_URL).rstrip("/")


def _fetch_preflight(
    seller_url: str,
    *,
    base_url: str | None = None,
    payment_headers: dict[str, str] | None = None,
    fresh: bool = True,
) -> dict[str, Any]:
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

    headers = {"accept": "application/json", **(payment_headers or {})}
    response = requests.get(
        f"{_resolve_base_url(base_url)}/preflight",
        params=params,
        headers=headers,
        timeout=30,
    )

    if response.status_code == 402:
        raise RuntimeError("x402check_payment_required")
    if not response.ok:
        raise RuntimeError(f"x402check_http_{response.status_code}")
    return response.json()


def _build_reason(check: dict[str, Any], extras: list[str] | None = None) -> str:
    extras = extras or []
    pay_to = check.get("payTo")
    network = check.get("network")
    price = check.get("priceUsd")
    reason_codes = check.get("reasonCodes") or []
    history = check.get("history") or {}

    parts = [f"x402check verdict={check.get('verdict')}"]
    if pay_to:
        parts.append(f"payTo={pay_to}")
    if network:
        parts.append(f"network={network}")
    if price is not None:
        parts.append(f"priceUsd={price}")
    if reason_codes:
        parts.append(f"reasons={','.join(reason_codes)}")

    history_bits: list[str] = []
    if history.get("payToChanges"):
        history_bits.append(f"payToChanges={len(history['payToChanges'])}")
    if history.get("priceChanges"):
        history_bits.append(f"priceChanges={len(history['priceChanges'])}")
    if isinstance(history.get("uptimePct"), int | float):
        history_bits.append(f"uptimePct={history['uptimePct']}")
    if history_bits:
        parts.append(f"history={{{','.join(history_bits)}}}")
    parts.extend(extras)
    return " ".join(parts)


def _should_abort(verdict: str | None, abort_on_caution: bool) -> bool:
    if verdict == "avoid":
        return True
    return bool(verdict == "caution" and abort_on_caution)


def create_x402check_before_payment(
    *,
    base_url: str | None = None,
    payment_headers: dict[str, str] | None = None,
    abort_on_caution: bool = False,
    fail_open: bool = False,
) -> Callable[[X402BeforePaymentContext], X402BeforePaymentDecision]:
    """Build a beforePayment hook returning the #1454 decision shape.

    Drop-in for ``X402Config.before_payment`` / ``beforePayment`` once #1454
    lands. Maps x402check ``ok|caution|avoid`` (live 402 price/network/payTo
    vs history, including payTo-change detection) into ``{abort, reason?, code?}``.

    Args:
        base_url: Override API origin.
        payment_headers: Optional PAYMENT-SIGNATURE headers for the $0.01 charge.
        abort_on_caution: Treat caution like avoid (default False).
        fail_open: Allow payment when the check itself fails (default False).

    Returns:
        A sync beforePayment callable.

    Example::

        from coinbase_agentkit import create_x402check_before_payment

        # One-line drop-in for the #1454 beforePayment seat:
        before_payment = create_x402check_before_payment()

    """

    def hook(ctx: X402BeforePaymentContext) -> X402BeforePaymentDecision:
        url = (ctx or {}).get("url") or ""
        if not url:
            if fail_open:
                return {
                    "abort": False,
                    "reason": "x402check: missing url in beforePayment context (failOpen)",
                    "code": "x402check:unavailable",
                }
            return {
                "abort": True,
                "reason": "x402check: missing url in beforePayment context",
                "code": "x402check:missing_url",
            }

        try:
            check = _fetch_preflight(
                url,
                base_url=base_url,
                payment_headers=payment_headers,
                fresh=True,
            )
        except Exception as exc:
            if fail_open:
                return {
                    "abort": False,
                    "reason": f"x402check preflight failed (failOpen): {exc}",
                    "code": "x402check:unavailable",
                }
            return {
                "abort": True,
                "reason": f"x402check preflight failed: {exc}",
                "code": "x402check:preflight_failed",
            }

        extras: list[str] = []
        ctx_pay_to = (ctx or {}).get("payTo")
        live_pay_to = check.get("payTo")
        if ctx_pay_to and live_pay_to and str(ctx_pay_to).lower() != str(live_pay_to).lower():
            extras.append(f"payToMismatch context={ctx_pay_to} live={live_pay_to}")
            return {
                "abort": True,
                "reason": _build_reason(check, extras),
                "code": "x402check:payto_mismatch",
            }

        ctx_network = (ctx or {}).get("network")
        live_network = check.get("network")
        if ctx_network and live_network and str(ctx_network).lower() != str(live_network).lower():
            extras.append(f"networkMismatch context={ctx_network} live={live_network}")
            if abort_on_caution:
                return {
                    "abort": True,
                    "reason": _build_reason(check, extras),
                    "code": "x402check:network_mismatch",
                }

        verdict = check.get("verdict")
        if _should_abort(verdict, abort_on_caution):
            return {
                "abort": True,
                "reason": _build_reason(check, extras),
                "code": f"x402check:{verdict}",
            }

        return {
            "abort": False,
            "reason": _build_reason(check, extras),
            "code": f"x402check:{verdict}",
        }

    return hook


# Awaitable alias kept for callers that prefer an async signature matching TS.
def create_x402check_before_payment_async(
    **kwargs: Any,
) -> Callable[[X402BeforePaymentContext], Awaitable[X402BeforePaymentDecision]]:
    """Async wrapper around :func:`create_x402check_before_payment`."""
    sync_hook = create_x402check_before_payment(**kwargs)

    async def hook(ctx: X402BeforePaymentContext) -> X402BeforePaymentDecision:
        return sync_hook(ctx)

    return hook
