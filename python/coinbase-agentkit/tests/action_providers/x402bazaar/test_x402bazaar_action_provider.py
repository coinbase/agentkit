"""Tests for the x402 Bazaar action provider."""

import json
from unittest.mock import patch

from coinbase_agentkit.action_providers.x402bazaar.x402bazaar_action_provider import (
    x402bazaar_action_provider,
)
from coinbase_agentkit.network import Network

MOCK_TOKEN = "0x1234567890abcdef1234567890abcdef12345678"

MOCK_VERDICT = {
    "verdict": "CAUTION",
    "confidence": "high",
    "headline": "Tradeable but owner can raise sell tax",
    "reasons": ["Owner can set sell tax up to 25%", "Liquidity not locked"],
    "recommendedMaxSizeUsd": 250,
    "cardUrl": "https://402.com.tr/brand/verdict?v=CAUTION",
    "detail": {},
    "receipt": None,
}


class _MockResponse:
    """A minimal requests.Response-like stub for fixture-based tests."""

    def __init__(self, status_code=200, json_body=None, text=""):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.text = text
        self._json_body = json_body

    def json(self):
        return self._json_body


def test_token_verdict_check_free_tier_success():
    """Free-tier call returns the unwrapped verdict and sets free=1."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = _MockResponse(json_body={"data": MOCK_VERDICT})

        result = x402bazaar_action_provider().token_verdict_check({}, {"address": MOCK_TOKEN})

        parsed = json.loads(result)
        assert parsed["success"] is True
        assert parsed["verdict"]["verdict"] == "CAUTION"
        assert parsed["verdict"]["recommendedMaxSizeUsd"] == 250

        _, kwargs = mock_get.call_args
        assert kwargs["params"]["address"] == MOCK_TOKEN
        assert kwargs["params"]["free"] == "1"


def test_token_verdict_check_includes_amount_usd():
    """amount_usd is forwarded as amountUsd in the query params."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = _MockResponse(json_body={"data": MOCK_VERDICT})

        x402bazaar_action_provider().token_verdict_check(
            {}, {"address": MOCK_TOKEN, "amount_usd": 500}
        )

        _, kwargs = mock_get.call_args
        assert kwargs["params"]["amountUsd"] == "500.0"


def test_token_verdict_check_unwrapped_response():
    """A raw (unwrapped) verdict body is returned directly."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = _MockResponse(json_body=MOCK_VERDICT)

        result = x402bazaar_action_provider().token_verdict_check({}, {"address": MOCK_TOKEN})
        parsed = json.loads(result)
        assert parsed["verdict"]["verdict"] == "CAUTION"


def test_token_verdict_check_payment_required():
    """A 402 response maps to a payment_required error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = _MockResponse(status_code=402, text="Payment Required")

        result = x402bazaar_action_provider().token_verdict_check({}, {"address": MOCK_TOKEN})
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "Payment required" in parsed["message"]


def test_token_verdict_check_http_error():
    """A non-ok response maps to a request-failed error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value = _MockResponse(status_code=500, text="Internal Server Error")

        result = x402bazaar_action_provider().token_verdict_check({}, {"address": MOCK_TOKEN})
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "500" in parsed["message"]


def test_token_verdict_check_network_error():
    """A thrown exception is captured as an error object."""
    with patch("requests.get", side_effect=Exception("Network error")):
        result = x402bazaar_action_provider().token_verdict_check({}, {"address": MOCK_TOKEN})
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "Network error" in parsed["details"]


def test_supports_network():
    """Only Base mainnet (evm) is supported."""
    provider = x402bazaar_action_provider()
    assert provider.supports_network(Network(protocol_family="evm", network_id="base-mainnet")) is True
    assert (
        provider.supports_network(Network(protocol_family="evm", network_id="ethereum-mainnet"))
        is False
    )
    assert provider.supports_network(Network(protocol_family="svm", network_id="solana-mainnet")) is False
