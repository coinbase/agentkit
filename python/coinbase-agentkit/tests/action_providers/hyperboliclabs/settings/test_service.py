"""Test HyperbolicLabs Settings service."""

from unittest.mock import ANY

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.constants import (
    SETTINGS_BASE_URL,
    SETTINGS_ENDPOINTS,
)
from coinbase_agentkit.action_providers.hyperboliclabs.settings.service import SettingsService
from coinbase_agentkit.action_providers.hyperboliclabs.settings.types import (
    WalletLinkRequest,
    WalletLinkResponse,
)


def test_settings_service_init(mock_api_key):
    """Test Settings service initialization."""
    service = SettingsService(mock_api_key)
    assert service.base_url == SETTINGS_BASE_URL


def test_settings_link_wallet_success(mock_request, mock_api_key):
    """Test successful wallet linking."""
    service = SettingsService(mock_api_key)
    mock_response = {
        "success": True,
    }
    mock_request.return_value.json.return_value = mock_response

    wallet_address = "0x1234567890abcdef1234567890abcdef12345678"
    request = WalletLinkRequest(address=wallet_address)
    response = service.link_wallet(request)

    assert isinstance(response, WalletLinkResponse)
    assert response.success is True

    mock_request.assert_called_with(
        method="POST",
        url=f"{SETTINGS_BASE_URL}{SETTINGS_ENDPOINTS['LINK_WALLET']}",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {mock_api_key}"},
        json={"address": wallet_address},
        params=None,
    )


@pytest.mark.parametrize(
    "invalid_address",
    [
        "0xinvalid",
        "not-a-wallet",
    ],
)
def test_settings_link_wallet_invalid_address(mock_request, mock_api_key, invalid_address):
    """Test wallet linking with invalid addresses."""
    service = SettingsService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError(
        "400 Bad Request: Invalid wallet address"
    )

    with pytest.raises(requests.exceptions.HTTPError, match="400 Bad Request"):
        request = WalletLinkRequest(address=invalid_address)
        service.link_wallet(request)


def test_settings_service_error_handling(mock_request, mock_api_key):
    """Test error handling in settings service."""
    service = SettingsService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("403 Forbidden: Unauthorized access")

    with pytest.raises(requests.exceptions.HTTPError, match="403 Forbidden"):
        address = "0x1234567890abcdef1234567890abcdef12345678"
        request = WalletLinkRequest(address=address)
        service.link_wallet(request)


def test_link_wallet_success(mock_request, mock_api_key):
    """Test that linking a wallet address works correctly."""
    service = SettingsService(mock_api_key)
    mock_request.return_value.json.return_value = {
        "success": True,
        "message": "Wallet address linked successfully",
        "address": "0x1234567890abcdef1234567890abcdef12345678",
    }

    wallet_address = "0x1234567890abcdef1234567890abcdef12345678"
    request = WalletLinkRequest(address=wallet_address)
    response = service.link_wallet(request)

    assert isinstance(response, WalletLinkResponse)
    assert response.success is True
    assert response.message == "Wallet address linked successfully"

    mock_request.assert_called_once_with(
        method="POST",
        url=f"{SETTINGS_BASE_URL}{SETTINGS_ENDPOINTS['LINK_WALLET']}",
        headers=ANY,
        json={"address": wallet_address},
        params=None,
    )


def test_link_wallet_invalid_address(mock_request, mock_api_key):
    """Test that linking an invalid wallet address raises an error."""
    service = SettingsService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError(
        "422 Client Error: Unprocessable Entity"
    )

    invalid_address = "not-a-valid-address"
    request = WalletLinkRequest(address=invalid_address)

    with pytest.raises(requests.exceptions.HTTPError):
        service.link_wallet(request)


def test_link_wallet_api_error(mock_request, mock_api_key):
    """Test that API errors are properly propagated."""
    service = SettingsService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError(
        "500 Server Error: Internal Server Error"
    )

    address = "0x1234567890abcdef1234567890abcdef12345678"
    request = WalletLinkRequest(address=address)

    with pytest.raises(requests.exceptions.HTTPError):
        service.link_wallet(request)
