"""Mocked WalletForge x402 client tests — no live paid settle."""

from __future__ import annotations

import json
from unittest.mock import Mock, patch

import pytest
from eth_account import Account

from coinbase_agentkit.action_providers.walletforge.client import (
    WalletForgeClient,
    WalletForgeX402Error,
    b64d,
    b64e,
    build_payment_payload,
    echo_extensions,
)
from coinbase_agentkit.action_providers.walletforge.constants import (
    AMOUNT_FETCH_MARKDOWN,
    AMOUNT_NORMALIZE,
    DEFAULT_ASSET,
    DEFAULT_PAY_TO,
)

from .conftest import MOCK_PRIVATE_KEY, payment_required


def _mock_response(status_code: int, json_body, headers=None):
    """Create a mock requests.Response."""
    resp = Mock()
    resp.status_code = status_code
    resp.headers = headers or {}
    resp.json.return_value = json_body
    resp.text = json.dumps(json_body)
    return resp


def test_echo_extensions_preserves_server_and_adds_client_only():
    """Test extension echo is append-only and does not overwrite server fields."""
    required = {
        "bazaar": {"info": {"serviceName": "WalletForge", "tags": ["a"]}},
        "other": {"info": {"x": 1}},
    }
    out = echo_extensions(
        required,
        client_extras={
            "bazaar": {"info": {"serviceName": "HACKED", "clientNote": "ok"}},
            "clientOnly": {"info": {"y": 2}},
        },
    )
    assert out["bazaar"]["info"]["serviceName"] == "WalletForge"
    assert out["bazaar"]["info"]["clientNote"] == "ok"
    assert out["clientOnly"]["info"]["y"] == 2
    assert out["other"]["info"]["x"] == 1
    out["bazaar"]["info"]["tags"].append("mut")
    assert required["bazaar"]["info"]["tags"] == ["a"]


def test_build_payment_payload_echoes_extensions_and_resource():
    """Test payment payload echoes resource and bazaar extensions."""
    account = Account.from_key(MOCK_PRIVATE_KEY)
    required = payment_required()

    def _sign(full_message):
        from eth_account.messages import encode_typed_data

        signed = account.sign_message(encode_typed_data(full_message=full_message))
        return "0x" + signed.signature.hex()

    payload = build_payment_payload(
        required,
        from_address=account.address,
        sign_typed_data=_sign,
        now=1_700_000_000,
    )

    assert payload["x402Version"] == 2
    assert payload["resource"] == required["resource"]
    assert payload["extensions"] == required["extensions"]
    assert "bazaar" in payload["extensions"]
    assert payload["accepted"]["amount"] == AMOUNT_NORMALIZE
    assert payload["accepted"]["extra"]["name"] == "USD Coin"
    assert payload["accepted"]["payTo"] == DEFAULT_PAY_TO
    assert payload["payload"]["signature"].startswith("0x")
    assert payload["payload"]["authorization"]["from"] == account.address
    assert len(payload["payload"]["authorization"]["nonce"]) == 66


def test_b64_roundtrip():
    """Test base64 JSON encode/decode roundtrip."""
    obj = {"a": 1, "b": "ü"}
    assert b64d(b64e(obj)) == obj


def test_pay_post_402_then_200_mock():
    """Test unpaid 402 then paid 200 with extension echo (mocked HTTP)."""
    required = payment_required()
    success_body = {
        "normalized": "hello",
        "emails": [],
        "urls": [],
        "phones": [],
        "stats": {"chars": 5},
    }
    settlement = {"success": True, "transaction": "0xabc"}
    buyer = WalletForgeClient.from_private_key(
        MOCK_PRIVATE_KEY, base_url="https://api.walletforge.app"
    )

    def side_effect(*_args, **kwargs):
        headers = kwargs.get("headers") or {}
        if headers.get("PAYMENT-SIGNATURE"):
            decoded = b64d(headers["PAYMENT-SIGNATURE"])
            assert decoded["extensions"]["bazaar"]["info"]["serviceName"] == "WalletForge"
            assert decoded["resource"]["url"].endswith("/v1/normalize")
            assert decoded["accepted"]["asset"].lower() == DEFAULT_ASSET.lower()
            return _mock_response(
                200,
                success_body,
                headers={"PAYMENT-RESPONSE": b64e(settlement)},
            )
        return _mock_response(402, required, headers={"PAYMENT-REQUIRED": b64e(required)})

    with patch(
        "coinbase_agentkit.action_providers.walletforge.client.requests.post",
        side_effect=side_effect,
    ):
        resp = buyer.pay_post("/v1/normalize", {"text": "hello"})

    assert resp.status_code == 200
    assert resp.data["normalized"] == "hello"
    assert resp.payment_response == settlement
    assert resp.payment_required is not None
    assert "bazaar" in resp.payment_required["extensions"]


def test_fetch_markdown_mock():
    """Test fetch_markdown paid path with mocked HTTP."""
    required = payment_required(
        amount=AMOUNT_FETCH_MARKDOWN,
        resource_url="https://api.walletforge.app/v1/fetch-markdown",
    )
    md_body = {"url": "https://example.com", "markdown": "# Hi", "chars": 4}
    buyer = WalletForgeClient.from_private_key(MOCK_PRIVATE_KEY)

    def side_effect(*_args, **kwargs):
        url = _args[0] if _args else kwargs.get("url")
        assert str(url).endswith("/v1/fetch-markdown")
        body = kwargs.get("json") or {}
        assert body["url"] == "https://example.com"
        assert body.get("max_chars") == 2000
        headers = kwargs.get("headers") or {}
        if headers.get("PAYMENT-SIGNATURE"):
            decoded = b64d(headers["PAYMENT-SIGNATURE"])
            assert decoded["accepted"]["amount"] == AMOUNT_FETCH_MARKDOWN
            return _mock_response(200, md_body)
        return _mock_response(402, required, headers={"PAYMENT-REQUIRED": b64e(required)})

    with patch(
        "coinbase_agentkit.action_providers.walletforge.client.requests.post",
        side_effect=side_effect,
    ):
        resp = buyer.fetch_markdown("https://example.com", max_chars=2000)

    assert resp.status_code == 200
    assert resp.data["markdown"] == "# Hi"


def test_from_private_key_does_not_keep_key():
    """Test the client does not retain the raw private key."""
    buyer = WalletForgeClient.from_private_key(MOCK_PRIVATE_KEY)
    assert buyer.address.startswith("0x")
    assert MOCK_PRIVATE_KEY not in repr(buyer)
    assert MOCK_PRIVATE_KEY[2:] not in repr(buyer)


def test_from_env_missing_key_raises(monkeypatch: pytest.MonkeyPatch):
    """Test from_env raises when no buyer key is configured."""
    monkeypatch.delenv("BUYER_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("X402_BUYER_PRIVATE_KEY", raising=False)
    with pytest.raises(WalletForgeX402Error):
        WalletForgeClient.from_env()


def test_unpaid_challenge_mock():
    """Test unpaid_challenge parses a mocked 402 without a signer."""
    required = payment_required()
    with patch(
        "coinbase_agentkit.action_providers.walletforge.client.requests.post",
        return_value=_mock_response(402, required, headers={"PAYMENT-REQUIRED": b64e(required)}),
    ):
        resp = WalletForgeClient.unpaid_challenge(
            "/v1/fetch-markdown",
            {"url": "https://example.com"},
        )
    assert resp.status_code == 402
    assert resp.payment_required["accepts"][0]["amount"] == AMOUNT_NORMALIZE
    assert resp.payment_required["accepts"][0]["payTo"] == DEFAULT_PAY_TO


def test_constants():
    """Test published price and settlement constants."""
    assert AMOUNT_NORMALIZE == "10000"
    assert AMOUNT_FETCH_MARKDOWN == "50000"
