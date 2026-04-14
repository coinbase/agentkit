"""Tests for the x402 action provider."""

import json
from unittest.mock import Mock

import pytest
import requests
from pydantic import ValidationError

from coinbase_agentkit.action_providers.x402.schemas import (
    DirectX402RequestSchema,
    HttpRequestSchema,
    PaymentOptionSchema,
    RetryWithX402Schema,
    X402Config,
)
from coinbase_agentkit.action_providers.x402.x402_action_provider import x402_action_provider
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_PAYMENT_PROOF,
    MOCK_PAYMENT_PROOF_HEADER,
    MOCK_PAYMENT_REQUIREMENTS,
    MOCK_URL,
)


def _build_paid_response(status_code: int = 200, include_payment_proof: bool = True):
    """Build a fake `requests.Response` for an x402-handled session call."""
    response = Mock(spec=requests.Response)
    response.status_code = status_code
    headers = {"content-type": "application/json"}
    if include_payment_proof:
        headers["x-payment-response"] = MOCK_PAYMENT_PROOF_HEADER
    response.headers = headers
    response.json.return_value = {"data": "paid_success"}
    return response


def _payment_option(**overrides):
    """Build a valid PaymentOptionSchema populated with MOCK_PAYMENT_REQUIREMENTS."""
    kwargs = {
        "scheme": MOCK_PAYMENT_REQUIREMENTS["scheme"],
        "network": MOCK_PAYMENT_REQUIREMENTS["network"],
        "asset": MOCK_PAYMENT_REQUIREMENTS["asset"],
        "max_amount_required": MOCK_PAYMENT_REQUIREMENTS["maxAmountRequired"],
        "pay_to": MOCK_PAYMENT_REQUIREMENTS["payTo"],
    }
    kwargs.update(overrides)
    return PaymentOptionSchema(**kwargs)


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
    payment_option = _payment_option()
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
    mock_requests.return_value = mock_requests.payment_required_response
    config = X402Config(registered_services=[MOCK_URL])
    provider = x402_action_provider(config)

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
# retry_with_x402 Tests
#
# Historical note: previous versions of these tests patched
# ``decode_x_payment_response`` on the provider module, but that symbol is no
# longer imported there — the provider inlines base64+JSON decoding of the
# payment response header. The old patch raised AttributeError in CI, which is
# why those tests were disabled. The tests below patch ``x402_requests`` at the
# provider module (where it is actually bound) and stub ``_create_x402_client``
# to avoid needing a real signer.
# =========================================================


def test_retry_with_x402_success_with_payment_proof(
    mock_wallet, mock_x402_session, patch_x402_client
):
    """Retry succeeds and surfaces decoded payment proof from response header."""
    mock_x402_session.request.return_value = _build_paid_response(include_payment_proof=True)
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(
        provider.retry_with_x402(
            mock_wallet,
            {"url": MOCK_URL, "method": "GET", "selected_payment_option": _payment_option()},
        )
    )

    assert response["status"] == "success"
    assert response["message"] == "Request completed successfully with payment"
    assert response["data"] == {"data": "paid_success"}
    assert response["details"]["paymentProof"]["transaction"] == MOCK_PAYMENT_PROOF["transaction"]
    assert response["details"]["paymentUsed"]["network"] == MOCK_PAYMENT_REQUIREMENTS["network"]


def test_retry_with_x402_success_without_payment_proof(
    mock_wallet, mock_x402_session, patch_x402_client
):
    """Retry succeeds with no payment-response header; paymentProof is None."""
    mock_x402_session.request.return_value = _build_paid_response(include_payment_proof=False)
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(
        provider.retry_with_x402(
            mock_wallet,
            {"url": MOCK_URL, "selected_payment_option": _payment_option()},
        )
    )

    assert response["status"] == "success"
    assert response["details"]["paymentProof"] is None


def test_retry_with_x402_non_200_does_not_claim_success(
    mock_wallet, mock_x402_session, patch_x402_client
):
    """Retry returning a non-200 must surface error status, not success."""
    mock_x402_session.request.return_value = _build_paid_response(
        status_code=500, include_payment_proof=False
    )
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(
        provider.retry_with_x402(
            mock_wallet,
            {"url": MOCK_URL, "selected_payment_option": _payment_option()},
        )
    )

    assert response["status"] == "error"
    assert response["httpStatus"] == 500
    assert "Payment was not settled" in response["message"]


def test_retry_with_x402_service_not_registered(mock_wallet):
    """Retrying an unregistered service returns a registration error."""
    provider = x402_action_provider()  # no registered services

    response = json.loads(
        provider.retry_with_x402(
            mock_wallet,
            {"url": MOCK_URL, "selected_payment_option": _payment_option()},
        )
    )

    assert response["error"] is True
    assert response["message"] == "Service not registered"


def test_retry_with_x402_rejects_non_usdc_asset(mock_wallet):
    """Retry refuses non-USDC assets."""
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(
        provider.retry_with_x402(
            mock_wallet,
            {
                "url": MOCK_URL,
                "selected_payment_option": _payment_option(
                    asset="0x0000000000000000000000000000000000000001"
                ),
            },
        )
    )

    assert response["error"] is True
    assert response["message"] == "Only USDC payments are supported"


def test_retry_with_x402_rejects_payment_over_limit(mock_wallet):
    """Retry enforces the configured max_payment_usdc limit."""
    # Default max_payment_usdc is 1.0 USDC. Request 2 USDC (2_000_000 atomic) to exceed it.
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(
        provider.retry_with_x402(
            mock_wallet,
            {
                "url": MOCK_URL,
                "selected_payment_option": _payment_option(max_amount_required="2000000"),
            },
        )
    )

    assert response["error"] is True
    assert response["message"] == "Payment exceeds limit"
    assert response["maxPaymentUsdc"] == 1.0


def test_retry_with_x402_network_mismatch(mock_wallet):
    """Retry rejects when the payment option's network is not supported by the wallet.

    The wallet stays on base-sepolia (so the base-sepolia USDC asset still passes
    ``is_usdc_asset``) while the payment option requests a network the wallet does
    not map to. This isolates the network-compatibility gate.
    """
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(
        provider.retry_with_x402(
            mock_wallet,
            {
                "url": MOCK_URL,
                "selected_payment_option": _payment_option(network="solana-mainnet"),
            },
        )
    )

    assert response["error"] is True
    assert response["message"] == "Network mismatch"


# =========================================================
# make_http_request_with_x402 Tests
# =========================================================


def test_make_http_request_with_x402_success_with_payment_proof(
    mock_wallet, mock_x402_session, patch_x402_client
):
    """Direct x402 call surfaces payment proof when present."""
    mock_x402_session.request.return_value = _build_paid_response(include_payment_proof=True)
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(
        provider.make_http_request_with_x402(mock_wallet, {"url": MOCK_URL, "method": "GET"})
    )

    assert response["success"] is True
    assert (
        response["message"]
        == "Request completed successfully (payment handled automatically if required)"
    )
    assert response["status"] == 200
    assert response["paymentProof"]["transaction"] == MOCK_PAYMENT_PROOF["transaction"]


def test_make_http_request_with_x402_success_without_payment_proof(
    mock_wallet, mock_x402_session, patch_x402_client
):
    """Direct x402 call with no payment header returns success and no proof."""
    mock_x402_session.request.return_value = _build_paid_response(include_payment_proof=False)
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(provider.make_http_request_with_x402(mock_wallet, {"url": MOCK_URL}))

    assert response["success"] is True
    assert response["paymentProof"] is None


def test_make_http_request_with_x402_non_200(mock_wallet, mock_x402_session, patch_x402_client):
    """Non-200 upstream responses must not be reported as success."""
    mock_x402_session.request.return_value = _build_paid_response(
        status_code=502, include_payment_proof=False
    )
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(provider.make_http_request_with_x402(mock_wallet, {"url": MOCK_URL}))

    assert response["success"] is False
    assert response["status"] == 502
    assert "Payment was not settled" in response["message"]


def test_make_http_request_with_x402_service_not_registered(mock_wallet):
    """Direct x402 call refuses unregistered services and hints at registration."""
    provider = x402_action_provider(
        X402Config(registered_services=[], allow_dynamic_service_registration=True)
    )

    response = json.loads(provider.make_http_request_with_x402(mock_wallet, {"url": MOCK_URL}))

    assert response["error"] is True
    assert response["message"] == "Service not registered"
    assert "register_x402_service" in response["suggestion"]


def test_make_http_request_with_x402_unsupported_wallet_provider():
    """Direct x402 call rejects non-EVM wallet providers."""
    from coinbase_agentkit.wallet_providers.wallet_provider import WalletProvider

    non_evm_wallet = Mock(spec=WalletProvider)
    provider = x402_action_provider(X402Config(registered_services=[MOCK_URL]))

    response = json.loads(provider.make_http_request_with_x402(non_evm_wallet, {"url": MOCK_URL}))

    assert response["error"] is True
    assert response["message"] == "Unsupported wallet provider"


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
