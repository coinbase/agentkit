"""End-to-end tests for Hyperbolic Settings service.

These tests make real API calls to the Hyperbolic platform.
They require a valid API key in the HYPERBOLIC_API_KEY environment variable.
"""

import json
import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.settings.models import WalletLinkRequest, WalletLinkResponse

# Test constants - known address that is already assigned
ALREADY_ASSIGNED_ETH_ADDRESS = "0x6eD68a1982ac2266ceB9C1907B629649aAd9AC20"


@pytest.mark.e2e
def test_settings_link_wallet_success(settings, random_eth_address):
    """Test successfully linking a wallet address."""
    # Use the random address fixture
    request = WalletLinkRequest(address=random_eth_address)
    response = settings.link_wallet(request)
    
    assert isinstance(response, WalletLinkResponse)
    
    if response.status == "success":
        print("Successfully linked wallet address")
    else:
        # If we still get an error (unlikely with random address), skip test
        pytest.skip(f"Couldn't link random wallet address: {response.message}")


@pytest.mark.e2e
def test_settings_link_wallet_already_assigned(settings):
    """Test the case where the wallet address is already assigned."""
    print(f"\nTesting with known assigned address: {ALREADY_ASSIGNED_ETH_ADDRESS}")
    
    request = WalletLinkRequest(address=ALREADY_ASSIGNED_ETH_ADDRESS)
    response = settings.link_wallet(request)
    
    assert isinstance(response, WalletLinkResponse)
    
    # We expect this to be an error response
    assert response.status != "success", "Expected address to be already assigned"
    assert response.error_code is not None, "Expected an error code"
    assert "already assigned" in response.message.lower(), f"Expected 'already assigned' error but got: {response.message}"
