"""Tests for x402check action provider."""

import json
from unittest.mock import MagicMock, patch

from coinbase_agentkit.action_providers.x402check.x402check_action_provider import (
    x402check_action_provider,
)

MOCK_OK = {
    "url": "https://www.api-xpay.com/x402/ping",
    "verdict": "ok",
    "payTo": "0x589a2314a2E05F45e40C4823Da3Ba58D421dB3d8",
    "priceUsd": 0.005,
    "network": "eip155:8453",
    "is402": True,
    "reasonCodes": ["reachable", "http_402", "payto_stable"],
    "history": {"checks": 3, "uptimePct": 100, "payToChanges": [], "priceChanges": []},
}


def test_preflight_check_success():
    """Successful preflight returns verdict + guidance."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.ok = True
    mock_resp.json.return_value = MOCK_OK

    with patch("requests.get", return_value=mock_resp) as mock_get:
        result = json.loads(
            x402check_action_provider(base_url="https://x402check.test").preflight_check(
                {"url": "https://www.api-xpay.com/x402/ping"}
            )
        )
        assert result["success"] is True
        assert result["verdict"] == "ok"
        assert result["payTo"] == MOCK_OK["payTo"]
        assert "still enforce" in result["guidance"]
        mock_get.assert_called_once()
        assert mock_get.call_args.kwargs["params"]["url"] == "https://www.api-xpay.com/x402/ping"


def test_preflight_check_payment_required():
    """402 from x402check returns structured payment_required error."""
    mock_resp = MagicMock()
    mock_resp.status_code = 402
    mock_resp.ok = False

    with patch("requests.get", return_value=mock_resp):
        result = json.loads(
            x402check_action_provider(base_url="https://x402check.test").preflight_check(
                {"url": "https://seller.example/api"}
            )
        )
        assert result["success"] is False
        assert result["error"] == "x402check_payment_required"
        assert "0.01" in result["hint"]


def test_verify_payto_mismatch():
    """expected_pay_to mismatch is flagged."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.ok = True
    mock_resp.json.return_value = MOCK_OK

    with patch("requests.get", return_value=mock_resp):
        result = json.loads(
            x402check_action_provider(base_url="https://x402check.test").verify_payto(
                {
                    "url": "https://www.api-xpay.com/x402/ping",
                    "expected_pay_to": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
                }
            )
        )
        assert result["action"] == "verify_payto"
        assert result["payToMatch"] is False
        assert "does not match" in result["mismatch"]


def test_supports_network():
    """Provider is network-agnostic."""
    from coinbase_agentkit.network import Network

    assert x402check_action_provider().supports_network(Network(protocol_family="evm")) is True
