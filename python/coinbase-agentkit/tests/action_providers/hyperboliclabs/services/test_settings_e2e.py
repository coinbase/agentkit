"""End-to-end tests for Hyperbolic Settings service.

These tests make real API calls to the Hyperbolic platform.
They require a valid API key in the HYPERBOLIC_API_KEY environment variable.
"""

import json
import pytest
import requests


@pytest.mark.e2e
def test_settings_link_wallet(settings):
    """Test linking a wallet address."""
    # Test with a valid Ethereum address
    valid_address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    response = settings.link_wallet(valid_address)
    print("\nWallet linking response:", json.dumps(response, indent=2))

    assert isinstance(response, dict)
    assert "status" in response
    assert response["status"] == "success"
    assert "message" in response
    assert "wallet" in response or "address" in response


@pytest.mark.e2e
@pytest.mark.parametrize(
    "invalid_address",
    [
        "0x123",  # Too short
        "0xinvalid",  # Invalid hex
        "742d35Cc6634C0532925a3b844Bc454e4438f44e",  # Missing 0x prefix
        "0x742d35Cc6634C0532925a3b844Bc454e4438f44e123",  # Too long
    ],
)
def test_settings_link_wallet_invalid(settings, invalid_address):
    """Test linking invalid wallet addresses."""
    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        settings.link_wallet(invalid_address)

    assert exc_info.value.response.status_code == 422 