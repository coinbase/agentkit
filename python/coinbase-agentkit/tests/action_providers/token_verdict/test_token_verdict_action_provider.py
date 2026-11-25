"""Tests for the Token Verdict action provider."""

import base64
import json
import time
from typing import Any

import pytest
import requests
from eth_account import Account
from eth_account.messages import encode_typed_data
from pydantic import ValidationError
from requests.models import PreparedRequest

from coinbase_agentkit.action_providers.token_verdict.constants import (
    TOKEN_VERDICT_BASE_URL,
    TOKEN_VERDICT_PATH,
)
from coinbase_agentkit.action_providers.token_verdict.schemas import TokenVerdictSchema
from coinbase_agentkit.action_providers.token_verdict.token_verdict_action_provider import (
    TokenVerdictActionProvider,
    token_verdict_action_provider,
)
from coinbase_agentkit.action_providers.token_verdict.utils import TokenVerdictOptions
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider

from .conftest import (
    CHALLENGE,
    PAY_TO,
    TOKEN,
    USDC,
    VERDICT,
    StubTransport,
    b64,
    make_response,
)

VALID_ARGS = {"address": TOKEN}

TRANSFER_WITH_AUTHORIZATION_TYPES = {
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
}


def challenge_response(
    request: PreparedRequest, challenge: dict[str, Any] = CHALLENGE
) -> requests.Response:
    """Replay a 402 challenge, as the live service does for an unpaid call."""
    return make_response(
        request,
        402,
        b"{}",
        {
            "Content-Type": "application/json",
            "PAYMENT-REQUIRED": b64(challenge),
        },
    )


def verdict_response(request: PreparedRequest) -> requests.Response:
    """Replay the settled 200 verdict response."""
    settlement = {
        "success": True,
        "transaction": "0x" + "0" * 64,
        "network": "eip155:8453",
        "payer": "0x0000000000000000000000000000000000000000",
    }
    return make_response(
        request,
        200,
        json.dumps(VERDICT).encode(),
        {
            "Content-Type": "application/json",
            "PAYMENT-RESPONSE": b64(settlement),
        },
    )


def make_provider() -> TokenVerdictActionProvider:
    """Create a provider with a plain session (transport is stubbed)."""
    return token_verdict_action_provider(TokenVerdictOptions(session=requests.Session()))


class TestTokenVerdictActionProvider:
    """Tests for TokenVerdictActionProvider."""

    def test_registers_a_single_token_verdict_action(self, wallet_provider: EvmWalletProvider):
        """Registers exactly one action, named as in the TypeScript provider."""
        provider = make_provider()
        actions = provider.get_actions(wallet_provider)
        assert [action.name for action in actions] == ["TokenVerdictActionProvider_token_verdict"]

    def test_supports_only_base_mainnet(self):
        """Accepts EVM wallets on Base mainnet only."""
        provider = make_provider()
        assert provider.supports_network(
            Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
        )
        assert provider.supports_network(
            Network(protocol_family="evm", network_id=None, chain_id="8453")
        )
        assert not provider.supports_network(
            Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1")
        )
        assert not provider.supports_network(
            Network(protocol_family="evm", network_id="base-sepolia", chain_id="84532")
        )
        assert not provider.supports_network(
            Network(protocol_family="solana", network_id="solana-mainnet", chain_id=None)
        )

    def test_pays_the_challenge_and_returns_the_verdict(
        self, wallet_provider: EvmWalletProvider, monkeypatch: pytest.MonkeyPatch
    ):
        """Pays the 402 with a genuine EIP-3009 authorization and returns the verdict.

        The whole client stack runs for real - the x402 requests session,
        the exact EVM scheme, and the wallet's own signer. Only the socket
        send is replayed, so the payment signature on the retry is a real
        EIP-712 signature that must recover to the wallet's address.
        """

        def handler(request: PreparedRequest, call_number: int) -> requests.Response:
            if call_number == 1:
                return challenge_response(request)
            return verdict_response(request)

        stub = StubTransport(handler)
        stub.install(monkeypatch)

        provider = make_provider()
        action = provider.get_actions(wallet_provider)[0]
        result = action.invoke(dict(VALID_ARGS))

        assert json.loads(result) == VERDICT
        assert len(stub.requests) == 2

        unpaid, paid = stub.requests
        assert unpaid.method == "POST"
        assert unpaid.url == f"{TOKEN_VERDICT_BASE_URL}{TOKEN_VERDICT_PATH}"
        assert unpaid.headers.get("PAYMENT-SIGNATURE") is None
        assert json.loads(unpaid.body) == {"address": TOKEN, "chain": "base"}

        signature_header = paid.headers.get("PAYMENT-SIGNATURE")
        assert signature_header is not None
        payment = json.loads(base64.b64decode(signature_header))
        assert payment["x402Version"] == 2
        assert payment["accepted"]["scheme"] == "exact"
        assert payment["accepted"]["network"] == "eip155:8453"
        assert payment["accepted"]["asset"] == USDC
        assert payment["accepted"]["amount"] == "20000"
        assert payment["accepted"]["payTo"] == PAY_TO

        authorization = payment["payload"]["authorization"]
        wallet_address = wallet_provider.get_address()
        assert authorization["from"] == wallet_address
        assert authorization["to"] == PAY_TO
        assert authorization["value"] == "20000"

        now = int(time.time())
        valid_after = int(authorization["validAfter"])
        valid_before = int(authorization["validBefore"])
        assert valid_after <= now
        assert valid_before > now
        # maxTimeoutSeconds (300) plus the SDK's clock-skew buffer (600).
        assert valid_before - valid_after == 900

        signable = encode_typed_data(
            full_message={
                "types": TRANSFER_WITH_AUTHORIZATION_TYPES,
                "primaryType": "TransferWithAuthorization",
                "domain": {
                    "name": "USD Coin",
                    "version": "2",
                    "chainId": 8453,
                    "verifyingContract": USDC,
                },
                "message": {
                    "from": authorization["from"],
                    "to": authorization["to"],
                    "value": int(authorization["value"]),
                    "validAfter": valid_after,
                    "validBefore": valid_before,
                    "nonce": authorization["nonce"],
                },
            }
        )
        signature = payment["payload"]["signature"]
        recovered = Account.recover_message(
            signable, signature=bytes.fromhex(signature.removeprefix("0x"))
        )
        assert recovered.lower() == wallet_address.lower()

    def test_refuses_to_pay_above_the_spend_guard(
        self, wallet_provider: EvmWalletProvider, monkeypatch: pytest.MonkeyPatch
    ):
        """A repriced challenge ($0.03) is refused before anything is signed."""
        repriced = {
            **CHALLENGE,
            "accepts": [{**CHALLENGE["accepts"][0], "amount": "30000"}],
        }

        def handler(request: PreparedRequest, call_number: int) -> requests.Response:
            del call_number
            return challenge_response(request, repriced)

        stub = StubTransport(handler)
        stub.install(monkeypatch)

        provider = make_provider()
        action = provider.get_actions(wallet_provider)[0]
        result = action.invoke(dict(VALID_ARGS))

        assert result.startswith("Error getting token verdict:")
        # The unpaid probe happened; no paid retry was ever attempted.
        assert len(stub.requests) == 1

    def test_returns_an_error_string_on_upstream_failure(
        self, wallet_provider: EvmWalletProvider, monkeypatch: pytest.MonkeyPatch
    ):
        """A non-402 upstream failure surfaces as an error string, not a throw."""

        def handler(request: PreparedRequest, call_number: int) -> requests.Response:
            del call_number
            return make_response(request, 404, b"Unknown token")

        stub = StubTransport(handler)
        stub.install(monkeypatch)

        provider = make_provider()
        action = provider.get_actions(wallet_provider)[0]
        result = action.invoke(dict(VALID_ARGS))

        assert "Error getting token verdict:" in result
        assert "404" in result


class TestTokenVerdictSchema:
    """Tests for TokenVerdictSchema."""

    def test_defaults_chain_to_base(self):
        """Only the address is required; chain defaults to base."""
        params = TokenVerdictSchema(address=TOKEN)
        assert params.address == TOKEN
        assert params.chain == "base"

    @pytest.mark.parametrize("chain", ["base", "ethereum", "solana"])
    def test_accepts_every_supported_chain_label(self, chain: str):
        """All three chain labels the service accepts validate."""
        params = TokenVerdictSchema(address=TOKEN, chain=chain)
        assert params.chain == chain

    @pytest.mark.parametrize(
        "address",
        [
            "0x123",
            "not-an-address",
            "0x" + "g" * 40,
            "2821d96B5FC81aEC3763340b375a846a89A3Ec1b",
        ],
    )
    def test_rejects_malformed_addresses(self, address: str):
        """Malformed contract addresses are refused."""
        with pytest.raises(ValidationError, match="0x token contract address"):
            TokenVerdictSchema(address=address)

    def test_rejects_an_unknown_chain(self):
        """Chain labels outside the service's contract are refused."""
        with pytest.raises(ValidationError):
            TokenVerdictSchema(address=TOKEN, chain="polygon")

    def test_requires_an_address(self):
        """The address argument is required."""
        with pytest.raises(ValidationError):
            TokenVerdictSchema()

    def test_rejects_unknown_fields(self):
        """Unknown fields are refused, mirroring the strict TS schema."""
        with pytest.raises(ValidationError):
            TokenVerdictSchema(address=TOKEN, bogus="field")
