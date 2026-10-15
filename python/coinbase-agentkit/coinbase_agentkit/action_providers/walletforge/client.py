"""Thin x402 V2 buyer for WalletForge (mirrors walletforge-x402).

Paid calls settle USDC on Base mainnet via EIP-3009. Tests must mock HTTP —
never perform a live paid settle in CI.
"""

from __future__ import annotations

import base64
import copy
import json
import os
import secrets
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

import requests
from eth_account import Account
from eth_account.messages import encode_typed_data

from .constants import DEFAULT_BASE_URL


class WalletForgeX402Error(Exception):
    """Base error for WalletForge x402 buyer failures."""


class PaymentRequiredError(WalletForgeX402Error):
    """Server returned 402 but PAYMENT-REQUIRED could not be used."""


class SettlementError(WalletForgeX402Error):
    """Paid retry did not succeed."""


def b64e(obj: Any) -> str:
    """Encode an object as base64 JSON (x402 header format)."""
    return base64.b64encode(
        json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
    ).decode()


def b64d(value: str) -> dict[str, Any]:
    """Decode a base64 JSON x402 header."""
    pad = "=" * (-len(value) % 4)
    return json.loads(base64.b64decode(value + pad))


def chain_id(network: str) -> int:
    """Parse a CAIP-2 eip155 network identifier into a chain id."""
    if ":" not in network:
        raise ValueError(f"bad network: {network}")
    ns, ref = network.split(":", 1)
    if ns != "eip155":
        raise ValueError(f"unsupported network namespace: {ns}")
    return int(ref)


def echo_extensions(
    required_extensions: Mapping[str, Any] | None,
    *,
    client_extras: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Echo server extensions into PaymentPayload.extensions.

    Spec rule: include at least the info received; may append additional
    keys/info but must not delete or overwrite existing extension info.
    """
    out: dict[str, Any] = copy.deepcopy(dict(required_extensions or {}))
    if not client_extras:
        return out
    for ext_id, extra_val in client_extras.items():
        if ext_id not in out:
            out[ext_id] = copy.deepcopy(extra_val)
            continue
        existing = out[ext_id]
        if isinstance(existing, dict) and isinstance(extra_val, Mapping):
            for k, v in extra_val.items():
                if k not in existing:
                    existing[k] = copy.deepcopy(v)
                elif isinstance(existing[k], dict) and isinstance(v, Mapping):
                    for sk, sv in v.items():
                        if sk not in existing[k]:
                            existing[k][sk] = copy.deepcopy(sv)
    return out


def _normalize_signature(signature: str) -> str:
    """Ensure a hex signature has a 0x prefix."""
    if signature.startswith("0x"):
        return signature
    return "0x" + signature


def sign_eip3009(
    *,
    from_address: str,
    sign_typed_data: Callable[[dict[str, Any]], str],
    asset: str,
    token_name: str,
    token_version: str,
    network: str,
    to: str,
    value: str,
    valid_after: int,
    valid_before: int,
    nonce: bytes,
) -> tuple[str, dict[str, str]]:
    """Sign an EIP-3009 TransferWithAuthorization and return (signature, auth)."""
    authorization = {
        "from": from_address,
        "to": to,
        "value": int(value),
        "validAfter": valid_after,
        "validBefore": valid_before,
        "nonce": nonce,
    }
    full_message = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ],
        },
        "primaryType": "TransferWithAuthorization",
        "domain": {
            "name": token_name,
            "version": token_version,
            "chainId": chain_id(network),
            "verifyingContract": asset,
        },
        "message": authorization,
    }
    signature = _normalize_signature(sign_typed_data(full_message))
    auth_out = {
        "from": from_address,
        "to": to,
        "value": str(value),
        "validAfter": str(valid_after),
        "validBefore": str(valid_before),
        "nonce": "0x" + nonce.hex(),
    }
    return signature, auth_out


def build_payment_payload(
    required: Mapping[str, Any],
    *,
    from_address: str,
    sign_typed_data: Callable[[dict[str, Any]], str],
    accept_index: int = 0,
    client_extension_extras: Mapping[str, Any] | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    """Build a V2 PaymentPayload from a decoded PAYMENT-REQUIRED object."""
    accepts = required.get("accepts") or []
    if not accepts:
        raise PaymentRequiredError("PAYMENT-REQUIRED has empty accepts[]")
    if accept_index >= len(accepts):
        raise PaymentRequiredError(f"accept_index {accept_index} out of range")

    accepted = copy.deepcopy(accepts[accept_index])
    extra = dict(accepted.get("extra") or {})
    token_name = extra.get("name") or "USD Coin"
    token_version = str(extra.get("version") or "2")
    accepted["extra"] = extra

    ts = int(time.time() if now is None else now)
    valid_after = 0
    valid_before = ts + int(accepted.get("maxTimeoutSeconds") or 60)
    nonce = secrets.token_bytes(32)

    signature, authorization = sign_eip3009(
        from_address=from_address,
        sign_typed_data=sign_typed_data,
        asset=accepted["asset"],
        token_name=token_name,
        token_version=token_version,
        network=accepted["network"],
        to=accepted["payTo"],
        value=str(accepted["amount"]),
        valid_after=valid_after,
        valid_before=valid_before,
        nonce=nonce,
    )

    resource = required.get("resource")
    payload: dict[str, Any] = {
        "x402Version": int(required.get("x402Version") or 2),
        "accepted": {
            "scheme": accepted["scheme"],
            "network": accepted["network"],
            "amount": str(accepted["amount"]),
            "asset": accepted["asset"],
            "payTo": accepted["payTo"],
            "maxTimeoutSeconds": accepted.get("maxTimeoutSeconds", 60),
            "extra": accepted["extra"],
        },
        "payload": {"signature": signature, "authorization": authorization},
        "extensions": echo_extensions(
            required.get("extensions"),
            client_extras=client_extension_extras,
        ),
    }
    if resource is not None:
        payload["resource"] = copy.deepcopy(resource)
    return payload


def _header_get(headers: Mapping[str, str], name: str) -> str | None:
    """Get a header value case-insensitively."""
    lower = name.lower()
    for k, v in headers.items():
        if k.lower() == lower:
            return v
    return None


def _account_sign_typed_data(account: Account) -> Callable[[dict[str, Any]], str]:
    """Return a sign_typed_data callable bound to an eth_account Account."""

    def _sign(full_message: dict[str, Any]) -> str:
        signable = encode_typed_data(full_message=full_message)
        signed = account.sign_message(signable)
        return "0x" + signed.signature.hex()

    return _sign


@dataclass
class PaidResponse:
    """Result of a WalletForge x402 request (paid or unpaid challenge)."""

    status_code: int
    data: Any
    headers: dict[str, str]
    payment_response: dict[str, Any] | None = None
    payment_required: dict[str, Any] | None = None


@dataclass
class WalletForgeClient:
    """Non-custodial x402 V2 buyer for WalletForge endpoints.

    Mirrors ``walletforge_x402.buyer.X402Buyer`` using ``requests`` +
    ``eth-account`` (already AgentKit dependencies). Optionally wraps an
    injected buyer instance from the published ``walletforge-x402`` package.
    """

    base_url: str = field(
        default_factory=lambda: os.getenv("X402_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    )
    timeout: float = 60.0
    client_extension_extras: dict[str, Any] = field(default_factory=dict)
    _address: str | None = field(default=None, repr=False)
    _sign_typed_data: Callable[[dict[str, Any]], str] | None = field(default=None, repr=False)

    @classmethod
    def from_private_key(
        cls,
        private_key: str,
        *,
        base_url: str | None = None,
        timeout: float = 60.0,
    ) -> WalletForgeClient:
        """Create a client from a hex private key. The key is not stored."""
        key = private_key if private_key.startswith("0x") else "0x" + private_key
        account = Account.from_key(key)
        return cls(
            base_url=(base_url or os.getenv("X402_BASE_URL") or DEFAULT_BASE_URL).rstrip("/"),
            timeout=timeout,
            _address=account.address,
            _sign_typed_data=_account_sign_typed_data(account),
        )

    @classmethod
    def from_env(cls, **kwargs: Any) -> WalletForgeClient:
        """Create a client from BUYER_PRIVATE_KEY / X402_BUYER_PRIVATE_KEY."""
        key = os.getenv("BUYER_PRIVATE_KEY") or os.getenv("X402_BUYER_PRIVATE_KEY")
        if not key:
            raise WalletForgeX402Error(
                "BUYER_PRIVATE_KEY (or X402_BUYER_PRIVATE_KEY) is required for paid calls "
                "when no AgentKit wallet provider is available"
            )
        return cls.from_private_key(key, **kwargs)

    @classmethod
    def from_wallet(
        cls,
        wallet_provider: Any,
        *,
        base_url: str | None = None,
        timeout: float = 60.0,
    ) -> WalletForgeClient:
        """Create a client that signs with an AgentKit EVM wallet provider."""
        return cls(
            base_url=(base_url or os.getenv("X402_BASE_URL") or DEFAULT_BASE_URL).rstrip("/"),
            timeout=timeout,
            _address=wallet_provider.get_address(),
            _sign_typed_data=lambda msg: wallet_provider.sign_typed_data(msg),
        )

    @property
    def address(self) -> str:
        """Return the buyer address used for EIP-3009 authorizations."""
        if not self._address:
            raise WalletForgeX402Error("WalletForge client has no signing address")
        return self._address

    def _post(
        self,
        path: str,
        body: dict[str, Any],
        *,
        payment_signature: str | None = None,
    ) -> requests.Response:
        url = f"{self.base_url}{path}" if path.startswith("/") else f"{self.base_url}/{path}"
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "coinbase-agentkit-walletforge/0.1",
        }
        if payment_signature:
            headers["PAYMENT-SIGNATURE"] = payment_signature
        return requests.post(url, json=body, headers=headers, timeout=self.timeout)

    def pay_post(
        self,
        path: str,
        body: dict[str, Any],
        *,
        accept_index: int = 0,
    ) -> PaidResponse:
        """POST unpaid; on 402 sign EIP-3009 and retry with PAYMENT-SIGNATURE."""
        if not self._address or not self._sign_typed_data:
            raise WalletForgeX402Error("WalletForge client is missing a signer")

        r1 = self._post(path, body)
        if r1.status_code != 402:
            try:
                data: Any = r1.json()
            except Exception:
                data = r1.text
            return PaidResponse(status_code=r1.status_code, data=data, headers=dict(r1.headers))

        hdr = _header_get(r1.headers, "PAYMENT-REQUIRED")
        if not hdr:
            raise PaymentRequiredError("402 without PAYMENT-REQUIRED header")
        required = b64d(hdr)
        if not required.get("accepts"):
            try:
                body_req = r1.json()
                if isinstance(body_req, dict) and body_req.get("accepts"):
                    required = body_req
            except Exception:
                pass

        payment_payload = build_payment_payload(
            required,
            from_address=self._address,
            sign_typed_data=self._sign_typed_data,
            accept_index=accept_index,
            client_extension_extras=self.client_extension_extras or None,
        )
        payment_sig = b64e(payment_payload)

        r2 = self._post(path, body, payment_signature=payment_sig)
        try:
            data2 = r2.json()
        except Exception:
            data2 = r2.text

        resp_hdr = _header_get(r2.headers, "PAYMENT-RESPONSE")
        payment_response = b64d(resp_hdr) if resp_hdr else None

        if r2.status_code >= 400:
            raise SettlementError(f"paid request failed status={r2.status_code} body={data2!r}")

        return PaidResponse(
            status_code=r2.status_code,
            data=data2,
            headers=dict(r2.headers),
            payment_response=payment_response,
            payment_required=required,
        )

    def fetch_markdown(self, url: str, *, max_chars: int | None = None) -> PaidResponse:
        """Pay for POST /v1/fetch-markdown and return the response."""
        body: dict[str, Any] = {"url": url}
        if max_chars is not None:
            body["max_chars"] = max_chars
        return self.pay_post("/v1/fetch-markdown", body)

    def normalize(self, text: str) -> PaidResponse:
        """Pay for POST /v1/normalize and return the response."""
        return self.pay_post("/v1/normalize", {"text": text})

    @staticmethod
    def unpaid_challenge(
        path: str = "/v1/normalize",
        body: dict[str, Any] | None = None,
        *,
        base_url: str | None = None,
        timeout: float = 30.0,
    ) -> PaidResponse:
        """Smoke an unpaid POST (expects 402). No private key needed."""
        base = (base_url or os.getenv("X402_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        url = f"{base}{path}"
        payload = body if body is not None else {"text": "smoke"}
        r = requests.post(
            url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "coinbase-agentkit-walletforge/0.1",
            },
            timeout=timeout,
        )
        hdr = _header_get(r.headers, "PAYMENT-REQUIRED")
        required = b64d(hdr) if hdr else None
        try:
            data = r.json()
        except Exception:
            data = r.text
        return PaidResponse(
            status_code=r.status_code,
            data=data,
            headers=dict(r.headers),
            payment_required=required,
        )
