"""Unit tests for Hyperbolic Settings service."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.constants import SETTINGS_BASE_URL, SETTINGS_ENDPOINTS
from coinbase_agentkit.action_providers.hyperboliclabs.settings.models import WalletLinkResponse
from coinbase_agentkit.action_providers.hyperboliclabs.settings.service import Settings


def test_settings_service_init(api_key):
    """Test Settings service initialization."""
    service = Settings(api_key)
    assert service.base_url == SETTINGS_BASE_URL


def test_settings_link_wallet_success(mock_request, api_key):
    """Test successful wallet linking."""
    service = Settings(api_key)
    mock_response = {
        "status": "success",
        "message": "Wallet linked successfully",
        "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
    }
    mock_request.return_value.json.return_value = mock_response

    wallet_address = "0x1234567890abcdef1234567890abcdef12345678"
    response = service.link_wallet(wallet_address)
    
    assert isinstance(response, WalletLinkResponse)
    assert response.status == "success"
    assert response.message == "Wallet linked successfully"
    assert response.wallet_address == wallet_address

    args = ("POST", f"{SETTINGS_BASE_URL}{SETTINGS_ENDPOINTS['LINK_WALLET']}")
    kwargs = {
        "headers": {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
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
def test_settings_link_wallet_invalid_address(mock_request, api_key, invalid_address):
    """Test wallet linking with invalid addresses."""
    service = Settings(api_key)
    mock_request.side_effect = requests.exceptions.HTTPError(
        "400 Bad Request: Invalid wallet address"
    )

    with pytest.raises(requests.exceptions.HTTPError, match="400 Bad Request"):
        service.link_wallet(invalid_address)


def test_settings_service_error_handling(mock_request, api_key):
    """Test error handling in settings service."""
    service = Settings(api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("403 Forbidden: Unauthorized access")

    with pytest.raises(requests.exceptions.HTTPError, match="403 Forbidden"):
        service.link_wallet("0x1234567890abcdef1234567890abcdef12345678") 