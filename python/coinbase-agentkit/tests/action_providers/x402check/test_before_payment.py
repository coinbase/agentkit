"""Tests for x402check beforePayment helper (#1454 decision shape)."""

from unittest.mock import MagicMock, patch

from coinbase_agentkit.action_providers.x402check.before_payment import (
    create_x402check_before_payment,
)

BASE_CTX = {
    "url": "https://seller.example/api",
    "payTo": "0xabc",
    "network": "eip155:8453",
    "asset": "0xUSDC",
    "amount": "2000",
    "method": "GET",
}

MOCK_OK = {
    "url": "https://seller.example/api",
    "verdict": "ok",
    "payTo": "0xabc",
    "network": "eip155:8453",
    "priceUsd": 0.002,
    "reasonCodes": ["reachable", "payto_stable"],
    "history": {"checks": 3, "uptimePct": 100, "payToChanges": [], "priceChanges": []},
}


def _ok_response(payload=None):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.ok = True
    mock_resp.json.return_value = payload or MOCK_OK
    return mock_resp


def test_allows_ok_with_1454_shape():
    """Ok verdict → abort False, only abort/reason/code keys."""
    with patch("requests.get", return_value=_ok_response()):
        decision = create_x402check_before_payment(base_url="https://x402check.test")(BASE_CTX)
    assert decision["abort"] is False
    assert decision["code"] == "x402check:ok"
    assert "verdict=ok" in decision["reason"]
    assert set(decision.keys()) == {"abort", "reason", "code"}


def test_aborts_on_avoid():
    """Avoid → abort True with machine-readable code."""
    payload = {**MOCK_OK, "verdict": "avoid", "reasonCodes": ["unreachable"]}
    with patch("requests.get", return_value=_ok_response(payload)):
        decision = create_x402check_before_payment(base_url="https://x402check.test")(
            {**BASE_CTX, "payTo": None}
        )
    assert decision["abort"] is True
    assert decision["code"] == "x402check:avoid"


def test_abort_on_caution_when_configured():
    """Caution + abort_on_caution → abort."""
    payload = {**MOCK_OK, "verdict": "caution"}
    with patch("requests.get", return_value=_ok_response(payload)):
        decision = create_x402check_before_payment(
            base_url="https://x402check.test", abort_on_caution=True
        )(BASE_CTX)
    assert decision["abort"] is True
    assert decision["code"] == "x402check:caution"


def test_caution_does_not_abort_by_default():
    """Caution alone reports code but does not abort."""
    payload = {**MOCK_OK, "verdict": "caution", "reasonCodes": ["price_drift"]}
    with patch("requests.get", return_value=_ok_response(payload)):
        decision = create_x402check_before_payment(base_url="https://x402check.test")(BASE_CTX)
    assert decision["abort"] is False
    assert decision["code"] == "x402check:caution"


def test_payto_mismatch_aborts():
    """Live payTo ≠ context payTo → integrity abort."""
    payload = {**MOCK_OK, "payTo": "0xdead"}
    with patch("requests.get", return_value=_ok_response(payload)):
        decision = create_x402check_before_payment(base_url="https://x402check.test")(BASE_CTX)
    assert decision["abort"] is True
    assert decision["code"] == "x402check:payto_mismatch"
    assert "payToMismatch" in decision["reason"]


def test_fails_closed_on_402():
    """Preflight 402 → abort (fail closed)."""
    mock_resp = MagicMock()
    mock_resp.status_code = 402
    mock_resp.ok = False
    with patch("requests.get", return_value=mock_resp):
        decision = create_x402check_before_payment(base_url="https://x402check.test")(BASE_CTX)
    assert decision["abort"] is True
    assert decision["code"] == "x402check:preflight_failed"


def test_fail_open_allows_on_error():
    """fail_open=True → allow when preflight fails."""
    mock_resp = MagicMock()
    mock_resp.status_code = 402
    mock_resp.ok = False
    with patch("requests.get", return_value=mock_resp):
        decision = create_x402check_before_payment(
            base_url="https://x402check.test", fail_open=True
        )(BASE_CTX)
    assert decision["abort"] is False
    assert decision["code"] == "x402check:unavailable"


def test_missing_url_aborts():
    """Missing url → abort with missing_url code."""
    decision = create_x402check_before_payment()({**BASE_CTX, "url": ""})
    assert decision["abort"] is True
    assert decision["code"] == "x402check:missing_url"
