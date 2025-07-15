"""Test fixtures for x402 action provider tests."""

from unittest.mock import Mock, patch

import pytest
import requests

from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

# Mock data constants
MOCK_URL = "https://api.example.com/data"
MOCK_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_PAYMENT_REQUIREMENTS = {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000",
    "resource": MOCK_URL,
    "description": "Access to data",
    "mimeType": "application/json",
    "payTo": "0x9876543210987654321098765432109876543210",
    "maxTimeoutSeconds": 300,
    "asset": "0x5555666677778888999900001111222233334444",
}

MOCK_PAYMENT_PROOF = {
    "transaction": "0xabcdef1234567890",
    "network": "base-sepolia",
    "payer": MOCK_ADDRESS,
}


@pytest.fixture
def mock_wallet():
    """Create a mock wallet provider."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS

    # Mock the signer
    mock_signer = Mock()
    mock.to_signer.return_value = mock_signer

    return mock


@pytest.fixture
def mock_requests():
    """Create a mock for requests with different response scenarios."""
    with patch("requests.request") as mock_request:
        # Create mock responses
        success_response = Mock(spec=requests.Response)
        success_response.status_code = 200
        success_response.headers = {"content-type": "application/json"}
        success_response.json.return_value = {"data": "success"}

        payment_required_response = Mock(spec=requests.Response)
        payment_required_response.status_code = 402
        payment_required_response.json.return_value = {"accepts": [MOCK_PAYMENT_REQUIREMENTS]}

        paid_response = Mock(spec=requests.Response)
        paid_response.status_code = 200
        paid_response.headers = {
            "content-type": "application/json",
            "x-payment-response": "mock_payment_response",
        }
        paid_response.json.return_value = {"data": "paid_success"}

        # Store responses on the mock for easy access in tests
        mock_request.success_response = success_response
        mock_request.payment_required_response = payment_required_response
        mock_request.paid_response = paid_response

        # Configure the mock to return different responses based on args
        def side_effect(*args, **kwargs):
            if kwargs.get("url") == MOCK_URL:
                if kwargs.get("method") == "GET":
                    return success_response
                elif kwargs.get("method") == "POST":
                    return payment_required_response
            return success_response

        mock_request.side_effect = side_effect

        yield mock_request


@pytest.fixture
def mock_x402_requests():
    """Create a mock for x402_requests session."""
    with patch("x402.clients.requests.x402_requests", autospec=True) as mock_x402:
        mock_session = Mock()
        mock_x402.return_value = mock_session

        # Create a successful paid response
        paid_response = Mock(spec=requests.Response)
        paid_response.status_code = 200
        paid_response.headers = {
            "content-type": "application/json",
            "x-payment-response": "mock_payment_response",
        }
        paid_response.json.return_value = {"data": "paid_success"}
        mock_session.request.return_value = paid_response

        yield mock_x402


@pytest.fixture
def mock_decode_payment():
    """Create a mock for decode_x_payment_response."""
    with patch("x402.clients.base.decode_x_payment_response", autospec=True) as mock_decode:
        mock_decode.return_value = MOCK_PAYMENT_PROOF
        yield mock_decode
