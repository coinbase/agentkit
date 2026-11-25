"""Fixtures for Token Verdict action provider tests."""

import base64
import json
from collections.abc import Callable
from typing import Any

import pytest
import requests
from eth_account import Account
from requests.adapters import HTTPAdapter
from requests.models import PreparedRequest
from requests.structures import CaseInsensitiveDict

from coinbase_agentkit.wallet_providers import (
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig,
)

TOKEN = "0x2821d96B5FC81aEC3763340b375a846a89a3Ec1b"
PAY_TO = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F"
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

# The challenge a production-shaped facilitator/service pair issues for one
# verdict: $0.02 of Base USDC to the service's payTo wallet.
CHALLENGE: dict[str, Any] = {
    "x402Version": 2,
    "error": "Payment required",
    "resource": {
        "url": "https://token-verdict-production.up.railway.app/v1/verdict",
        "description": (
            "Token Verdict - pay-per-call token risk verdicts "
            "(SOLID/CAUTION/DANGER, 0-100 score, six market-structure signals)."
        ),
        "mimeType": "application/json",
    },
    "accepts": [
        {
            "scheme": "exact",
            "network": "eip155:8453",
            "asset": USDC,
            "amount": "20000",
            "payTo": PAY_TO,
            "maxTimeoutSeconds": 300,
            "extra": {
                "name": "USD Coin",
                "version": "2",
            },
        }
    ],
}

# The service engine's published example verdict.
VERDICT: dict[str, Any] = {
    "token": {
        "address": TOKEN,
        "symbol": "BASE",
        "name": "Base King",
        "chain": "base",
    },
    "verdict": "CAUTION",
    "score": 35.0,
    "signals": [
        {
            "name": "Liquidity depth",
            "score": 5,
            "weight": 3,
            "detail": "Deep liquidity ($259,106) — the book can absorb real selling.",
        },
        {
            "name": "Volume churn",
            "score": 60,
            "weight": 2,
            "detail": "24h volume is just $0 — effectively no market.",
        },
        {
            "name": "Sell pressure",
            "score": 60,
            "weight": 2,
            "detail": "67% sells vs 33% buys — clear distribution.",
        },
        {
            "name": "Price action",
            "score": 10,
            "weight": 2,
            "detail": "24h price action (+0.6%) is unremarkable.",
        },
        {
            "name": "Trader breadth",
            "score": 70,
            "weight": 1,
            "detail": "Only 3 transactions in 24h — a handful of wallets IS the market.",
        },
        {
            "name": "Pair age",
            "score": 5,
            "weight": 1,
            "detail": "Pair has meaningful history.",
        },
    ],
    "take": (
        "BASE (Base King) trades at $0.0003238 on uniswap with $259.1k in liquidity. "
        "Trading has effectively stopped — $0 of volume across 3 transactions in "
        "24h — so this is a dormant book, not a live market, whatever the liquidity "
        "figure says. Verdict: CAUTION — tradable at most in small size, and the "
        "signals above are why."
    ),
    "market": {
        "price_usd": "0.0003238",
        "liquidity_usd": 259106,
        "volume_24h_usd": 0.01,
        "price_change_24h_pct": 0.55,
        "txns_24h": {"buys": 1, "sells": 2},
        "dex": "uniswap",
        "pair_url": "https://dexscreener.com/base/0x2821d96b5fc81aec3763340b375a846a89a3ec1b",
    },
}


def b64(obj: Any) -> str:
    """Encode an object as base64 JSON, as x402 headers carry it."""
    return base64.b64encode(json.dumps(obj).encode()).decode()


def make_response(
    request: PreparedRequest,
    status_code: int,
    body: bytes,
    headers: dict[str, str] | None = None,
) -> requests.Response:
    """Build a requests.Response for a stubbed transport reply."""
    response = requests.Response()
    response.status_code = status_code
    response._content = body
    response.headers = CaseInsensitiveDict(headers or {})
    response.request = request
    response.url = request.url or ""
    response.encoding = "utf-8"
    return response


class StubTransport:
    """Stubs HTTP at the requests adapter layer.

    The provider's genuine x402 session, client, and exact EVM scheme all
    run; only the final socket send is replayed by the handler, so no test
    ever touches the network or a real payment rail.
    """

    def __init__(
        self,
        handler: Callable[[PreparedRequest, int], requests.Response],
    ):
        """Initialize the stub transport with a reply handler."""
        self.handler = handler
        self.requests: list[PreparedRequest] = []

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Patch HTTPAdapter.send so every request is recorded and replayed."""
        stub = self

        def fake_send(
            adapter: HTTPAdapter, request: PreparedRequest, **kwargs: Any
        ) -> requests.Response:
            del adapter, kwargs
            stub.requests.append(request)
            return stub.handler(request, len(stub.requests))

        monkeypatch.setattr(HTTPAdapter, "send", fake_send)


@pytest.fixture(autouse=True)
def _no_analytics(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep action invocations offline, as other provider suites do."""
    monkeypatch.setattr(
        "coinbase_agentkit.action_providers.action_decorator.send_analytics_event",
        lambda event: None,
    )


@pytest.fixture
def wallet_provider() -> EthAccountWalletProvider:
    """Create a real EVM wallet provider over a throwaway local account.

    Construction performs no network I/O (the RPC URL is never called);
    signing happens locally against the in-memory account.
    """
    account = Account.create()
    return EthAccountWalletProvider(
        config=EthAccountWalletProviderConfig(
            account=account,
            chain_id="8453",
            rpc_url="http://localhost:8545",
        )
    )
