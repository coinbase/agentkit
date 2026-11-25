"""Tests for the x402 action provider."""

import json
from unittest.mock import Mock, patch

import pytest
import requests
from eth_account import Account
from pydantic import ValidationError
from x402.schemas import PaymentRequired, PaymentRequirements
from x402.schemas.errors import NoMatchingRequirementsError

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
# Spend Controls Tests
# =========================================================


def _payment_required(
    amount: str,
    asset: str = MOCK_PAYMENT_REQUIREMENTS["asset"],
    network: str = "eip155:84532",
    pay_to: str = MOCK_PAYMENT_REQUIREMENTS["payTo"],
    scheme: str = "exact",
):
    """Build a v2 PaymentRequired for base-sepolia."""
    return PaymentRequired(
        x402_version=2,
        accepts=[
            PaymentRequirements(
                scheme=scheme,
                network=network,
                asset=asset,
                amount=amount,
                pay_to=pay_to,
                max_timeout_seconds=300,
                extra={"name": "USDC", "version": "2"},
            )
        ],
    )


@pytest.fixture
def signing_wallet(mock_wallet):
    """Wallet whose signer is a real eth_account key, so x402 can actually sign."""
    mock_wallet.to_signer.return_value = Account.from_key("0x" + "11" * 32)
    mock_wallet.get_network.return_value = Network(
        chain_id="84532", network_id="base-sepolia", protocol_family="evm"
    )
    return mock_wallet


def test_create_client_sets_spend_cap_from_config(signing_wallet):
    """The x402 client is created with max_amount_per_payment = max_payment_usdc."""
    provider = x402_action_provider(X402Config(max_payment_usdc=0.25))
    client = provider._create_x402_client(signing_wallet)

    assert client._spend_controls == {"max_amount_per_payment": 0.25}


@pytest.mark.parametrize("bad_cap", [float("nan"), float("inf"), -1.0])
def test_create_client_rejects_invalid_cap(signing_wallet, bad_cap):
    """An invalid max_payment_usdc fails closed instead of leaving the client uncapped."""
    provider = x402_action_provider(X402Config(max_payment_usdc=bad_cap))

    with pytest.raises(ValueError, match="max_payment_usdc"):
        provider._create_x402_client(signing_wallet)


def test_client_refuses_to_sign_over_cap_requirements(signing_wallet):
    """Server requirements above the cap are rejected by x402, so nothing is signed."""
    provider = x402_action_provider(X402Config(max_payment_usdc=1.0))
    client = provider._create_x402_client(signing_wallet)

    with pytest.raises(Exception, match="spend_controls"):
        client.create_payment_payload(_payment_required("5000000"))


def test_client_refuses_to_sign_non_default_asset(signing_wallet):
    """Non-default assets are rejected by x402 even when the amount is tiny."""
    provider = x402_action_provider(X402Config(max_payment_usdc=1.0))
    client = provider._create_x402_client(signing_wallet)

    with pytest.raises(Exception, match="spend_controls"):
        client.create_payment_payload(
            _payment_required("100", asset="0x1111111111111111111111111111111111111111")
        )


def _selected_payment_option(amount: str = "10000") -> PaymentOptionSchema:
    return PaymentOptionSchema(
        scheme="exact",
        network="eip155:84532",
        asset=MOCK_PAYMENT_REQUIREMENTS["asset"],
        max_amount_required=amount,
        pay_to=MOCK_PAYMENT_REQUIREMENTS["payTo"],
    )


def test_retry_client_rejects_server_terms_not_in_selected_option(signing_wallet):
    """A fresh 402 cannot change the amount or recipient approved by the caller."""
    provider = x402_action_provider(X402Config(max_payment_usdc=1.0))
    client = provider._create_x402_client(signing_wallet, _selected_payment_option())

    with pytest.raises(NoMatchingRequirementsError):
        client.create_payment_payload(_payment_required("20000"))

    with pytest.raises(NoMatchingRequirementsError):
        client.create_payment_payload(
            _payment_required("10000", pay_to="0x2222222222222222222222222222222222222222")
        )


def test_retry_client_rejects_network_outside_wallet(signing_wallet):
    """A fresh 402 cannot move a payment to a network outside the wallet's network."""
    provider = x402_action_provider(X402Config(max_payment_usdc=1.0))
    client = provider._create_x402_client(signing_wallet)

    with pytest.raises(NoMatchingRequirementsError):
        client.create_payment_payload(_payment_required("10000", network="eip155:1"))


def test_client_signs_within_cap(signing_wallet):
    """Requirements within the cap on the default asset are signed."""
    provider = x402_action_provider(X402Config(max_payment_usdc=1.0))
    client = provider._create_x402_client(signing_wallet, _selected_payment_option())

    payload = client.create_payment_payload(_payment_required("10000"))

    assert payload.accepted.amount == "10000"


@patch("coinbase_agentkit.action_providers.x402.x402_action_provider.register_exact_evm_client")
@patch("coinbase_agentkit.action_providers.x402.x402_action_provider.x402ClientSync")
def test_before_payment_hook_registered(mock_client_cls, _mock_register, mock_wallet):
    """The before_payment hook is passed to the x402 client the provider builds."""
    hook = lambda context: None  # noqa: E731

    provider = x402_action_provider(X402Config(before_payment=hook))

    provider._create_x402_client(mock_wallet)

    mock_client_cls.return_value.on_before_payment_creation.assert_called_once_with(hook)


@patch("coinbase_agentkit.action_providers.x402.x402_action_provider.register_exact_evm_client")
@patch("coinbase_agentkit.action_providers.x402.x402_action_provider.x402ClientSync")
def test_before_payment_hook_not_registered_by_default(
    mock_client_cls, _mock_register, mock_wallet
):
    """Without before_payment, no hook is registered."""
    provider = x402_action_provider()

    provider._create_x402_client(mock_wallet)

    mock_client_cls.return_value.on_before_payment_creation.assert_not_called()
