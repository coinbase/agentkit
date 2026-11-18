"""Tests for ThoughtProof action provider."""

import json
from unittest.mock import MagicMock, patch

import pytest
import requests

from coinbase_agentkit.action_providers.thoughtproof.schemas import (
    GetVerificationReceiptSchema,
    VerifyReasoningSchema,
)
from coinbase_agentkit.action_providers.thoughtproof.thoughtproof_action_provider import (
    ThoughtProofActionProvider,
    thoughtproof_action_provider,
)

MOCK_API_KEY = "tp_test_key_123"
MOCK_CLAIM = "Swapping 1 ETH for USDC on Uniswap v3 is safe at current slippage"
MOCK_AGENT_ID = "agent-28388"


# ── Schema Tests ──────────────────────────────────────────────────────────


def test_verify_reasoning_schema_valid():
    """Test that VerifyReasoningSchema accepts valid parameters."""
    schema = VerifyReasoningSchema(claim=MOCK_CLAIM)
    assert schema.claim == MOCK_CLAIM
    assert schema.context is None
    assert schema.domain is None
    assert schema.speed is None


def test_verify_reasoning_schema_all_fields():
    """Test that VerifyReasoningSchema accepts all optional parameters."""
    schema = VerifyReasoningSchema(
        claim=MOCK_CLAIM,
        context="Uniswap v3 pool has $50M TVL",
        domain="financial",
        speed="deep",
    )
    assert schema.domain == "financial"
    assert schema.speed == "deep"


def test_verify_reasoning_schema_missing_claim():
    """Test that VerifyReasoningSchema rejects missing claim."""
    with pytest.raises(ValueError):
        VerifyReasoningSchema()


def test_verify_reasoning_schema_invalid_domain():
    """Test that VerifyReasoningSchema rejects invalid domain."""
    with pytest.raises(ValueError):
        VerifyReasoningSchema(claim=MOCK_CLAIM, domain="invalid")


def test_verify_reasoning_schema_invalid_speed():
    """Test that VerifyReasoningSchema rejects invalid speed."""
    with pytest.raises(ValueError):
        VerifyReasoningSchema(claim=MOCK_CLAIM, speed="turbo")


def test_get_verification_receipt_schema_valid():
    """Test that GetVerificationReceiptSchema accepts valid parameters."""
    schema = GetVerificationReceiptSchema(
        agent_id=MOCK_AGENT_ID,
        claim=MOCK_CLAIM,
        verdict="ALLOW",
    )
    assert schema.agent_id == MOCK_AGENT_ID
    assert schema.verdict == "ALLOW"


def test_get_verification_receipt_schema_invalid_verdict():
    """Test that GetVerificationReceiptSchema rejects invalid verdict."""
    with pytest.raises(ValueError):
        GetVerificationReceiptSchema(
            agent_id=MOCK_AGENT_ID,
            claim=MOCK_CLAIM,
            verdict="MAYBE",
        )


def test_get_verification_receipt_schema_missing_fields():
    """Test that GetVerificationReceiptSchema rejects missing required fields."""
    with pytest.raises(ValueError):
        GetVerificationReceiptSchema(claim=MOCK_CLAIM)


# ── Provider Init Tests ───────────────────────────────────────────────────


def test_provider_init_with_api_key():
    """Test provider initialization with explicit API key."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)
    assert provider.api_key == MOCK_API_KEY


def test_provider_init_with_env_var(monkeypatch):
    """Test provider initialization with environment variable."""
    monkeypatch.setenv("THOUGHTPROOF_API_KEY", MOCK_API_KEY)
    provider = thoughtproof_action_provider()
    assert provider.api_key == MOCK_API_KEY


def test_provider_init_missing_credentials():
    """Test provider initialization fails without credentials."""
    with pytest.raises(ValueError, match="THOUGHTPROOF_API_KEY is not configured"):
        thoughtproof_action_provider()


def test_provider_headers():
    """Test that headers include API key."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)
    headers = provider._get_headers()
    assert headers["X-API-Key"] == MOCK_API_KEY
    assert headers["Content-Type"] == "application/json"


def test_provider_supports_all_networks():
    """Test that provider supports all networks."""
    from coinbase_agentkit.network import Network

    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)
    assert provider.supports_network(Network.BASE_MAINNET) is True
    assert provider.supports_network(Network.BASE_SEPOLIA) is True


# ── verify_reasoning Tests ────────────────────────────────────────────────


def test_verify_reasoning_success():
    """Test successful reasoning verification."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)

    mock_response = MagicMock()
    mock_response.ok = True
    mock_response.json.return_value = {
        "verdict": "ALLOW",
        "confidence": 0.92,
        "objections": [],
        "durationMs": 1500,
        "modelCount": 4,
    }

    with patch("requests.post", return_value=mock_response) as mock_post:
        result = provider.verify_reasoning({"claim": MOCK_CLAIM})
        parsed = json.loads(result)

        assert parsed["success"] is True
        assert parsed["verdict"] == "ALLOW"
        assert parsed["confidence"] == 0.92
        assert parsed["modelCount"] == 4

        # Verify correct URL
        call_args = mock_post.call_args
        assert "/v1/check" in call_args[0][0]
        assert call_args[1]["json"]["claim"] == MOCK_CLAIM


def test_verify_reasoning_with_options():
    """Test reasoning verification with all optional parameters."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)

    mock_response = MagicMock()
    mock_response.ok = True
    mock_response.json.return_value = {
        "verdict": "BLOCK",
        "confidence": 0.35,
        "objections": ["High slippage risk", "Low liquidity"],
        "durationMs": 8000,
        "modelCount": 4,
    }

    with patch("requests.post", return_value=mock_response) as mock_post:
        result = provider.verify_reasoning({
            "claim": MOCK_CLAIM,
            "context": "Pool has only $10K TVL",
            "domain": "financial",
            "speed": "deep",
        })
        parsed = json.loads(result)

        assert parsed["success"] is True
        assert parsed["verdict"] == "BLOCK"
        assert len(parsed["objections"]) == 2

        request_body = mock_post.call_args[1]["json"]
        assert request_body["context"] == "Pool has only $10K TVL"
        assert request_body["domain"] == "financial"
        assert request_body["speed"] == "deep"


def test_verify_reasoning_api_error():
    """Test reasoning verification with API error response."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)

    mock_response = MagicMock()
    mock_response.ok = False
    mock_response.status_code = 429
    mock_response.text = "Rate limit exceeded"

    with patch("requests.post", return_value=mock_response):
        result = provider.verify_reasoning({"claim": MOCK_CLAIM})
        parsed = json.loads(result)

        assert parsed["success"] is False
        assert "429" in parsed["error"]


def test_verify_reasoning_network_error():
    """Test reasoning verification with network error."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)

    with patch("requests.post", side_effect=requests.exceptions.ConnectionError("timeout")):
        result = provider.verify_reasoning({"claim": MOCK_CLAIM})
        parsed = json.loads(result)

        assert parsed["success"] is False
        assert "Request failed" in parsed["error"]


# ── get_verification_receipt Tests ────────────────────────────────────────


def test_get_verification_receipt_success():
    """Test successful verification receipt creation."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)

    mock_response = MagicMock()
    mock_response.ok = True
    mock_response.json.return_value = {
        "receiptId": "rec_abc123",
        "agentId": MOCK_AGENT_ID,
        "claim": MOCK_CLAIM,
        "verdict": "ALLOW",
        "score": 0.92,
        "jwt": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.test",
        "verifyUrl": "https://api.thoughtproof.ai/v1/receipts/rec_abc123",
    }

    with patch("requests.post", return_value=mock_response) as mock_post:
        result = provider.get_verification_receipt({
            "agent_id": MOCK_AGENT_ID,
            "claim": MOCK_CLAIM,
            "verdict": "ALLOW",
        })
        parsed = json.loads(result)

        assert parsed["success"] is True
        assert parsed["receiptId"] == "rec_abc123"
        assert parsed["jwt"].startswith("eyJ")
        assert parsed["verifyUrl"] is not None

        request_body = mock_post.call_args[1]["json"]
        assert request_body["agentId"] == MOCK_AGENT_ID


def test_get_verification_receipt_with_metadata():
    """Test receipt creation with optional metadata."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)

    mock_response = MagicMock()
    mock_response.ok = True
    mock_response.json.return_value = {
        "receiptId": "rec_xyz789",
        "agentId": MOCK_AGENT_ID,
        "verdict": "BLOCK",
        "score": 0.25,
        "jwt": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.block",
        "verifyUrl": "https://api.thoughtproof.ai/v1/receipts/rec_xyz789",
    }

    with patch("requests.post", return_value=mock_response) as mock_post:
        result = provider.get_verification_receipt({
            "agent_id": MOCK_AGENT_ID,
            "claim": MOCK_CLAIM,
            "verdict": "BLOCK",
            "domain": "financial",
            "metadata": {"chain": "base", "txValue": "1.5 ETH"},
        })
        parsed = json.loads(result)

        assert parsed["success"] is True
        assert parsed["verdict"] == "BLOCK"

        request_body = mock_post.call_args[1]["json"]
        assert request_body["domain"] == "financial"
        assert request_body["metadata"]["chain"] == "base"


def test_get_verification_receipt_api_error():
    """Test receipt creation with API error."""
    provider = thoughtproof_action_provider(api_key=MOCK_API_KEY)

    mock_response = MagicMock()
    mock_response.ok = False
    mock_response.status_code = 404
    mock_response.text = "Agent not found"

    with patch("requests.post", return_value=mock_response):
        result = provider.get_verification_receipt({
            "agent_id": "nonexistent-agent",
            "claim": MOCK_CLAIM,
            "verdict": "ALLOW",
        })
        parsed = json.loads(result)

        assert parsed["success"] is False
        assert "404" in parsed["error"]
