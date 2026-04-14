"""Test fixtures for x402 action provider tests."""

import base64
import json
from unittest.mock import Mock, patch

import pytest
import requests

from coinbase_agentkit.network import Network
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
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # Real USDC address on base-sepolia
}

MOCK_PAYMENT_PROOF = {
    "transaction": "0xabcdef1234567890",
    "network": "base-sepolia",
    "payer": MOCK_ADDRESS,
}

# Pre-encoded payment proof header matching the provider's base64+JSON decode path.
MOCK_PAYMENT_PROOF_HEADER = base64.b64encode(json.dumps(MOCK_PAYMENT_PROOF).encode()).decode()


@pytest.fixture
def mock_wallet():
    """Create a mock wallet provider with a base-sepolia network."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.get_network.return_value = Network(
        chain_id="84532", network_id="base-sepolia", protocol_family="evm"
    )
    mock.to_signer.return_value = Mock()
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
        payment_required_response.headers = {}
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
def mock_x402_session():
    """Patch x402_requests at the provider module path and return the mock session.

    Patching at the provider's own module is important: the provider imports
    ``x402_requests`` directly (``from x402.http.clients.requests import x402_requests``),
    so tests must patch the reference attached to the provider module rather than the
    upstream package. Patching the upstream symbol would not affect the already-bound
    reference and fails inconsistently across environments.
    """
    with patch(
        "coinbase_agentkit.action_providers.x402.x402_action_provider.x402_requests"
    ) as mock_factory:
        mock_session = Mock()
        mock_factory.return_value = mock_session
        yield mock_session


@pytest.fixture
def patch_x402_client():
    """Bypass real x402 client construction (which needs a signable wallet)."""
    with patch(
        "coinbase_agentkit.action_providers.x402.x402_action_provider."
        "x402ActionProvider._create_x402_client"
    ) as patched:
        patched.return_value = Mock()
        yield patched
