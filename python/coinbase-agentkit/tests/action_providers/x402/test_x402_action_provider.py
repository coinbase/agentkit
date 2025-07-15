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
    valid_input = {
        "url": MOCK_URL,
        "scheme": MOCK_PAYMENT_REQUIREMENTS["scheme"],
        "network": MOCK_PAYMENT_REQUIREMENTS["network"],
        "max_amount_required": MOCK_PAYMENT_REQUIREMENTS["maxAmountRequired"],
        "resource": MOCK_PAYMENT_REQUIREMENTS["resource"],
        "pay_to": MOCK_PAYMENT_REQUIREMENTS["payTo"],
        "max_timeout_seconds": MOCK_PAYMENT_REQUIREMENTS["maxTimeoutSeconds"],
        "asset": MOCK_PAYMENT_REQUIREMENTS["asset"],
    }
    schema = RetryWithX402Schema(**valid_input)
    assert schema.url == MOCK_URL
    assert schema.network == MOCK_PAYMENT_REQUIREMENTS["network"]


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
    provider = x402_action_provider()

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
    provider = x402_action_provider()

    response = json.loads(
        provider.make_http_request(mock_wallet, {"url": MOCK_URL, "method": "POST"})
    )

    assert response["status"] == "error_402_payment_required"
    assert len(response["acceptablePaymentOptions"]) == 1
    payment_option = response["acceptablePaymentOptions"][0]
    assert payment_option["network"] == MOCK_PAYMENT_REQUIREMENTS["network"]
    assert len(response["nextSteps"]) == 4


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
