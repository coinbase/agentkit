"""Unit tests for Hyperbolic Settings service."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.constants import SETTINGS_BASE_URL
from coinbase_agentkit.action_providers.hyperboliclabs.services.settings import Settings

from ..conftest import TEST_API_KEY


def test_settings_service_init():
    """Test Settings service initialization."""
    service = Settings(TEST_API_KEY)
    assert service.base_url == SETTINGS_BASE_URL


def test_settings_link_wallet_success(mock_request):
    """Test successful wallet linking."""
    service = Settings(TEST_API_KEY)
    mock_request.return_value.json.return_value = {
        "status": "success",
        "message": "Wallet linked successfully",
        "wallet": "0x1234567890abcdef1234567890abcdef12345678",
    }

    wallet_address = "0x1234567890abcdef1234567890abcdef12345678"
    response = service.link_wallet(wallet_address)
    assert response["status"] == "success"
    assert "message" in response
    assert response["wallet"] == wallet_address

    args = ("POST", f"{SETTINGS_BASE_URL}/link_wallet")
    kwargs = {
        "headers": {"Authorization": f"Bearer {TEST_API_KEY}", "Content-Type": "application/json"},
        "json": {"wallet_address": wallet_address},
    }
    mock_request.assert_called_with(*args, **kwargs)


@pytest.mark.parametrize(
    "invalid_address",
    [
        "0x123",  # Too short
        "0xinvalid",  # Invalid format
        "not-a-wallet",  # Not a wallet address
    ],
)
def test_settings_link_wallet_invalid_address(mock_request, invalid_address):
    """Test wallet linking with invalid addresses."""
    service = Settings(TEST_API_KEY)
    mock_request.side_effect = requests.exceptions.HTTPError(
        "400 Bad Request: Invalid wallet address"
    )

    with pytest.raises(requests.exceptions.HTTPError, match="400 Bad Request"):
        service.link_wallet(invalid_address)


def test_settings_service_error_handling(mock_request):
    """Test error handling in settings service."""
    service = Settings(TEST_API_KEY)
    mock_request.side_effect = requests.exceptions.HTTPError("403 Forbidden: Unauthorized access")

    with pytest.raises(requests.exceptions.HTTPError, match="403 Forbidden"):
        service.link_wallet("0x1234567890abcdef1234567890abcdef12345678") 