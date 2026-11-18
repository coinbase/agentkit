"""Tests for the x402 action provider."""

import json
from unittest.mock import Mock

import pytest
import requests
from pydantic import ValidationError

from coinbase_agentkit.action_providers.x402.schemas import (
    DirectX402RequestSchema,
    HttpRequestSchema,
    RetryWithX402Schema,
)
from coinbase_agentkit.action_providers.x402.x402_action_provider import x402_action_provider
from coinbase_agentkit.network import Network

from .conftest import (
    # MOCK_PAYMENT_PROOF,
    MOCK_PAYMENT_REQUIREMENTS,
    MOCK_URL,
)

# =========================================================
# Schema Tests
# =========================================================


def test_http_request_schema_valid():
    """Test that the HttpRequestSchema validates correctly."""
    valid_inputs = [
        {"url": MOCK_URL},  # Minimal
        {"url": MOCK_URL, "method": "GET"},  # With method
        {
            "url": MOCK_URL,
            "method": "POST",
            "headers": {"Accept": "application/json"},
        },  # With headers
        {"url": MOCK_URL, "method": "PUT", "headers": {}, "body": {"key": "value"}},  # With body
    ]

    for input_data in valid_inputs:
        schema = HttpRequestSchema(**input_data)
        assert schema.url == MOCK_URL
        if "method" in input_data:
            assert schema.method == input_data["method"]


def test_http_request_schema_invalid():
    """Test that the HttpRequestSchema fails on invalid input."""
    invalid_inputs = [
        {},  # Missing required url
        {"url": MOCK_URL, "method": "INVALID"},  # Invalid method
    ]

    for input_data in invalid_inputs:
        with pytest.raises(ValidationError):
            HttpRequestSchema(**input_data)


def test_retry_schema_valid():
    """Test that the RetryWithX402Schema validates correctly."""
    from coinbase_agentkit.action_providers.x402.schemas import PaymentOptionSchema

    payment_option = PaymentOptionSchema(
        scheme=MOCK_PAYMENT_REQUIREMENTS["scheme"],
        network=MOCK_PAYMENT_REQUIREMENTS["network"],
        asset=MOCK_PAYMENT_REQUIREMENTS["asset"],
        max_amount_required=MOCK_PAYMENT_REQUIREMENTS["maxAmountRequired"],
        pay_to=MOCK_PAYMENT_REQUIREMENTS["payTo"],
    )
    valid_input = {
        "url": MOCK_URL,
        "selected_payment_option": payment_option,
    }
    schema = RetryWithX402Schema(**valid_input)
    assert schema.url == MOCK_URL
    assert schema.selected_payment_option.network == MOCK_PAYMENT_REQUIREMENTS["network"]


def test_retry_schema_invalid():
    """Test that the RetryWithX402Schema fails on invalid input."""
    with pytest.raises(ValidationError):
        RetryWithX402Schema(url=MOCK_URL)  # Missing required payment fields


def test_direct_schema_valid():
    """Test that the DirectX402RequestSchema validates correctly."""
    valid_input = {"url": MOCK_URL}
    schema = DirectX402RequestSchema(**valid_input)
    assert schema.url == MOCK_URL


def test_direct_schema_invalid():
    """Test that the DirectX402RequestSchema fails on invalid input."""
    with pytest.raises(ValidationError):
        DirectX402RequestSchema()  # Missing required url


# =========================================================
# make_http_request Tests
# =========================================================


def test_make_http_request_success(mock_wallet, mock_requests):
    """Test successful HTTP request without payment requirement."""
    from coinbase_agentkit.action_providers.x402.schemas import X402Config

    mock_requests.return_value = mock_requests.success_response
    config = X402Config(registered_services=[MOCK_URL])
    provider = x402_action_provider(config)

    response = json.loads(
        provider.make_http_request(mock_wallet, {"url": MOCK_URL, "method": "GET"})
    )

    assert response["success"] is True
    assert response["url"] == MOCK_URL
    assert response["method"] == "GET"
    assert response["status"] == 200
    assert response["data"] == {"data": "success"}


def test_make_http_request_402(mock_wallet, mock_requests):
    """Test HTTP request that returns 402 Payment Required."""
    from coinbase_agentkit.action_providers.x402.schemas import X402Config
    from coinbase_agentkit.network import Network

    mock_requests.return_value = mock_requests.payment_required_response
    config = X402Config(registered_services=[MOCK_URL])
    provider = x402_action_provider(config)

    # Mock the wallet network
    mock_wallet.get_network.return_value = Network(
        chain_id="84532", network_id="base-sepolia", protocol_family="evm"
    )

    response = json.loads(
        provider.make_http_request(mock_wallet, {"url": MOCK_URL, "method": "POST"})
    )

    assert response["status"] == "error_402_payment_required"
    assert len(response["acceptablePaymentOptions"]) == 1
    payment_option = response["acceptablePaymentOptions"][0]
    assert payment_option["network"] == MOCK_PAYMENT_REQUIREMENTS["network"]
    assert len(response["nextSteps"]) > 0


def test_make_http_request_error(mock_wallet, mock_requests):
    """Test HTTP request that raises an error."""
    error = requests.exceptions.RequestException("Network error")
    error.request = Mock()  # Add request attribute to trigger network error case
    mock_requests.side_effect = error
    provider = x402_action_provider()

    response = json.loads(provider.make_http_request(mock_wallet, {"url": MOCK_URL}))

    assert response["error"] is True
    assert "message" in response  # Don't test exact message
    assert "details" in response  # Don't test exact details
    assert "suggestion" in response


# =========================================================
# retry_http_request_with_x402 Tests
# =========================================================


# TODO: These tests are temporarily disabled due to inconsistent mock patching behavior between local and CI/CD environments.
# The tests pass locally but fail in CI/CD with AttributeError. This is likely due to differences in how Python imports
# and patches modules in different environments. These tests should be revisited and fixed with a more robust mocking strategy.
# @patch("coinbase_agentkit.action_providers.x402.x402_action_provider.x402_requests")
# @patch("coinbase_agentkit.action_providers.x402.x402_action_provider.decode_x_payment_response")
# def test_retry_with_x402_success(mock_decode_payment, mock_x402_requests, mock_wallet):
#     """Test successful retry with payment."""
#     provider = x402_action_provider()
#     args = {
#         "url": MOCK_URL,
#         "method": "GET",
#         "scheme": MOCK_PAYMENT_REQUIREMENTS["scheme"],
#         "network": MOCK_PAYMENT_REQUIREMENTS["network"],
#         "max_amount_required": MOCK_PAYMENT_REQUIREMENTS["maxAmountRequired"],
#         "resource": MOCK_PAYMENT_REQUIREMENTS["resource"],
#         "pay_to": MOCK_PAYMENT_REQUIREMENTS["payTo"],
#         "max_timeout_seconds": MOCK_PAYMENT_REQUIREMENTS["maxTimeoutSeconds"],
#         "asset": MOCK_PAYMENT_REQUIREMENTS["asset"],
#     }
#
#     # Configure mock response
#     mock_session = Mock()
#     mock_x402_requests.return_value = mock_session
#     response = Mock(spec=requests.Response)
#     response.status_code = 200
#     response.headers = {
#         "content-type": "application/json",
#         "x-payment-response": "mock_payment_response",
#     }
#     response.json.return_value = {"data": "paid_success"}
#     mock_session.request.return_value = response
#
#     # Configure mock payment proof
#     mock_decode_payment.return_value = MOCK_PAYMENT_PROOF
#
#     response = json.loads(provider.retry_with_x402(mock_wallet, args))
#
#     assert response["success"] is True
#     assert response["message"] == "Request completed successfully with payment"
#     assert response["details"]["paymentProof"]["transaction"] == MOCK_PAYMENT_PROOF["transaction"]


# @patch("coinbase_agentkit.action_providers.x402.x402_action_provider.x402_requests")
# def test_retry_with_x402_no_payment_proof(mock_x402_requests, mock_wallet):
#     """Test retry where payment proof is not in response headers."""
#     mock_session = Mock()
#     mock_x402_requests.return_value = mock_session
#     response = Mock(spec=requests.Response)
#     response.status_code = 200
#     response.headers = {"content-type": "application/json"}
#     response.json.return_value = {"data": "success"}
#     mock_session.request.return_value = response
#
#     provider = x402_action_provider()
#     args = {
#         "url": MOCK_URL,
#         "method": "GET",
#         "scheme": MOCK_PAYMENT_REQUIREMENTS["scheme"],
#         "network": MOCK_PAYMENT_REQUIREMENTS["network"],
#         "max_amount_required": MOCK_PAYMENT_REQUIREMENTS["maxAmountRequired"],
#         "resource": MOCK_PAYMENT_REQUIREMENTS["resource"],
#         "pay_to": MOCK_PAYMENT_REQUIREMENTS["payTo"],
#         "max_timeout_seconds": MOCK_PAYMENT_REQUIREMENTS["maxTimeoutSeconds"],
#         "asset": MOCK_PAYMENT_REQUIREMENTS["asset"],
#     }
#
#     response = json.loads(provider.retry_with_x402(mock_wallet, args))
#
#     assert response["success"] is True
#     assert response["message"] == "Request completed successfully with payment"
#     assert response["details"]["paymentProof"] is None


# @patch("coinbase_agentkit.action_providers.x402.x402_action_provider.x402_requests")
# @patch("coinbase_agentkit.action_providers.x402.x402_action_provider.decode_x_payment_response")
# def test_make_http_request_with_x402_success(mock_decode_payment, mock_x402_requests, mock_wallet):
#     """Test successful direct request with automatic payment."""
#     provider = x402_action_provider()
#
#     # Configure mock response
#     mock_session = Mock()
#     mock_x402_requests.return_value = mock_session
#     response = Mock(spec=requests.Response)
#     response.status_code = 200
#     response.headers = {
#         "content-type": "application/json",
#         "x-payment-response": "mock_payment_response",
#     }
#     response.json.return_value = {"data": "paid_success"}
#     mock_session.request.return_value = response
#
#     # Configure mock payment proof
#     mock_decode_payment.return_value = MOCK_PAYMENT_PROOF
#
#     response = json.loads(
#         provider.make_http_request_with_x402(mock_wallet, {"url": MOCK_URL, "method": "GET"})
#     )
#
#     assert response["success"] is True
#     assert (
#         response["message"]
#         == "Request completed successfully (payment handled automatically if required)"
#     )
#     assert response["paymentProof"]["transaction"] == MOCK_PAYMENT_PROOF["transaction"]


# =========================================================
# Network Support Tests
# =========================================================


def test_supports_network():
    """Test network support based on protocol family and network ID."""
    test_cases = [
        (Network(chain_id="1", network_id="base-mainnet", protocol_family="evm"), True),
        (Network(chain_id="1", network_id="base-sepolia", protocol_family="evm"), True),
        (Network(chain_id="1", network_id="ethereum", protocol_family="evm"), False),
        (Network(chain_id="1", network_id="base-mainnet", protocol_family="solana"), False),
    ]

    provider = x402_action_provider()
    for network, expected in test_cases:
        assert provider.supports_network(network) is expected


# =========================================================
# Pre-Sign Spend Policy & Delivery Receipt Verification Tests
# =========================================================


def test_spend_policy_blocks_unauthorized_pay_to_before_signing(mock_wallet, monkeypatch):
    """Test that live 402 pre-sign policy blocks unauthorized payTo before signing."""
    import importlib
    from types import SimpleNamespace

    from coinbase_agentkit.action_providers.x402.schemas import X402Config

    mod = importlib.import_module("coinbase_agentkit.action_providers.x402.x402_action_provider")

    captured_hook = {}

    class DummyClient:
        def on_before_payment_creation(self, fn):
            captured_hook["fn"] = fn
            return self

    monkeypatch.setattr(mod, "x402ClientSync", DummyClient)
    monkeypatch.setattr(mod, "register_exact_evm_client", lambda *_a, **_k: None)
    monkeypatch.setattr(mod, "EthAccountSigner", lambda s: s)

    def fake_x402_requests(_client):
        class FakeSession:
            def request(self, **_kwargs):
                ctx = SimpleNamespace(
                    payment_required={},
                    selected_requirements={
                        "scheme": "exact",
                        "network": "base-sepolia",
                        "asset": MOCK_PAYMENT_REQUIREMENTS["asset"],
                        "amount": "10000",
                        "payTo": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
                    },
                )
                res = captured_hook["fn"](ctx)
                if res is not None:
                    raise RuntimeError(res.reason)
                raise AssertionError("Expected pre-sign policy abort")

        return FakeSession()

    monkeypatch.setattr(mod, "x402_requests", fake_x402_requests)
    mock_wallet.get_network.return_value = Network(
        chain_id="84532", network_id="base-sepolia", protocol_family="evm"
    )

    provider = x402_action_provider(
        X402Config(
            registered_services=[MOCK_URL],
            spend_policy={
                "allowedPayTo": [MOCK_PAYMENT_REQUIREMENTS["payTo"]],
                "maxPerCallAtomic": 50_000,
            },
        )
    )
    out = json.loads(provider.make_http_request_with_x402(mock_wallet, {"url": MOCK_URL}))
    assert out["error"] is True
    assert out["message"] == "Payment blocked by policy"
    assert "untrusted_pay_to" in out["details"]


def test_delivery_receipt_capture_void_and_standalone_verify(mock_wallet, monkeypatch):
    """Test post-delivery Payment-Receipt verification, MemorySpendLedger commit, and tampering detection."""
    import base64
    import importlib
    from types import SimpleNamespace

    from paxiom_receipts import MemorySpendLedger, generate_receipt_keypair, issue_receipt

    from coinbase_agentkit.action_providers.x402.schemas import PaymentOptionSchema, X402Config

    mod = importlib.import_module("coinbase_agentkit.action_providers.x402.x402_action_provider")

    kp = generate_receipt_keypair("py-agentkit-seller-1")
    ledger = MemorySpendLedger()
    good_body = {"weather": "sunny", "tempF": 72}
    pay_to = MOCK_PAYMENT_REQUIREMENTS["payTo"]
    usdc = MOCK_PAYMENT_REQUIREMENTS["asset"]

    issued = issue_receipt(
        private_key=kp["privateKeyPem"],
        issuer={"name": "Seller", "keyId": kp["keyId"], "payTo": pay_to},
        service={"name": "Weather", "resource": MOCK_URL, "method": "GET"},
        request={"method": "GET", "resource": MOCK_URL, "body": ""},
        payment={
            "scheme": "exact",
            "network": "eip155:84532",
            "asset": usdc,
            "amountAtomic": "10000",
            "payTo": pay_to,
            "settlement": {"status": "verify_only", "transactionHash": None},
        },
        output=good_body,
    )

    captured_hook = {}

    class DummyClient:
        def on_before_payment_creation(self, fn):
            captured_hook["fn"] = fn
            return self

    monkeypatch.setattr(mod, "x402ClientSync", DummyClient)
    monkeypatch.setattr(mod, "register_exact_evm_client", lambda *_a, **_k: None)
    monkeypatch.setattr(mod, "EthAccountSigner", lambda s: s)

    next_body = {"value": good_body}

    def fake_x402_requests(_client):
        class FakeSession:
            def request(self, **_kwargs):
                ctx = SimpleNamespace(
                    payment_required={},
                    selected_requirements={
                        "scheme": "exact",
                        "network": "base-sepolia",
                        "asset": usdc,
                        "amount": "10000",
                        "payTo": pay_to,
                    },
                )
                abort = captured_hook["fn"](ctx)
                assert abort is None
                resp = Mock(spec=requests.Response)
                resp.status_code = 200
                resp.text = json.dumps(next_body["value"])
                resp.headers = {
                    "content-type": "application/json",
                    "payment-response": base64.b64encode(
                        json.dumps({"transaction": "0xabc", "network": "base-sepolia"}).encode()
                    ).decode(),
                    "payment-receipt": issued["receiptHeader"],
                }
                return resp

        return FakeSession()

    monkeypatch.setattr(mod, "x402_requests", fake_x402_requests)
    mock_wallet.get_network.return_value = Network(
        chain_id="84532", network_id="base-sepolia", protocol_family="evm"
    )

    provider = x402_action_provider(
        X402Config(
            registered_services=[MOCK_URL],
            spend_policy={"allowedPayTo": [pay_to], "maxSessionAtomic": 100_000},
            spend_ledger=ledger,
            require_delivery_receipt=True,
            expected_issuer_public_keys=[kp["publicKey"]],
        )
    )

    selected = PaymentOptionSchema(
        scheme="exact",
        network="base-sepolia",
        asset=usdc,
        max_amount_required="10000",
        pay_to=pay_to,
    )
    ok_res = json.loads(
        provider.retry_with_x402(
            mock_wallet, {"url": MOCK_URL, "method": "GET", "selected_payment_option": selected}
        )
    )
    assert ok_res["status"] == "success"
    assert ok_res["details"]["deliveryReceipt"]["valid"] is True
    assert ok_res["details"]["deliveryReceipt"]["action"] == "CAPTURE"
    assert ledger.snapshot()["committedSessionAtomic"] == 10_000

    # Tampered body fails closed with VOID
    next_body["value"] = {"weather": "tampered", "tempF": -99}
    bad_res = json.loads(
        provider.retry_with_x402(
            mock_wallet, {"url": MOCK_URL, "method": "GET", "selected_payment_option": selected}
        )
    )
    assert bad_res["status"] == "error"
    assert bad_res["error"] is True
    assert bad_res["details"]["deliveryReceipt"]["action"] == "VOID"
    assert bad_res["details"]["deliveryReceipt"]["reasonCode"] == "receipt_output_hash_mismatch"

    # Standalone offline verify_x402_delivery_receipt action
    standalone = json.loads(
        provider.verify_x402_delivery_receipt(
            mock_wallet,
            {
                "receipt_or_header": issued["receiptHeader"],
                "response_body": good_body,
                "expected_pay_to": pay_to,
                "expected_issuer_public_keys": [kp["publicKey"]],
            },
        )
    )
    assert standalone["valid"] is True
    assert standalone["trustState"] == "verified"
    assert standalone["arbiter"]["action"] == "CAPTURE"
