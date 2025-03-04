"""Tests for the link_wallet_address action."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.schemas import LinkWalletAddressSchema

from .conftest import MOCK_API_KEY, MOCK_WALLET_ADDRESS


def test_link_wallet_address_schema_valid():
    """Test that LinkWalletAddressSchema is valid with required parameters."""
    schema = LinkWalletAddressSchema(wallet_address=MOCK_WALLET_ADDRESS)
    assert isinstance(schema, LinkWalletAddressSchema)
    assert schema.wallet_address == MOCK_WALLET_ADDRESS


def test_link_wallet_address_schema_invalid():
    """Test that LinkWalletAddressSchema validation fails with missing parameters."""
    with pytest.raises(ValueError):
        LinkWalletAddressSchema()


def test_link_wallet_address_success(hyperbolic_provider, mock_make_api_request):
    """Test successful link_wallet_address with valid response."""
    # Mock API response
    mock_response = {
        "status": "success",
        "message": "Wallet address linked successfully",
        "deposit_address": "0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60"
    }
    mock_make_api_request.return_value = mock_response

    # Call the action
    args = {"wallet_address": MOCK_WALLET_ADDRESS}
    result = hyperbolic_provider.link_wallet_address(args)

    # Verify the result
    assert "status" in result
    assert "success" in result
    assert "Wallet address linked successfully" in result
    assert "Next Steps:" in result
    assert "Your wallet has been successfully linked" in result
    assert "To add funds, send any of these tokens on Base network" in result
    assert "0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60" in result

    # Verify API call
    mock_make_api_request.assert_called_once_with(
        api_key=MOCK_API_KEY,
        endpoint="settings/crypto-address",
        data={"address": MOCK_WALLET_ADDRESS}
    )


def test_link_wallet_address_error(hyperbolic_provider, mock_make_api_request):
    """Test error handling in link_wallet_address."""
    # Mock API error
    error_message = "Invalid wallet address format"
    mock_make_api_request.side_effect = Exception(error_message)

    # Call the action
    args = {"wallet_address": MOCK_WALLET_ADDRESS}
    result = hyperbolic_provider.link_wallet_address(args)

    # Verify the result
    assert result == f"Error linking wallet address: {error_message}" 