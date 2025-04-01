"""Tests for the Onramp action provider."""

import json
from urllib.parse import parse_qs, urlparse

import pytest

from coinbase_agentkit.action_providers.onramp.constants import VERSION
from coinbase_agentkit.action_providers.onramp.onramp_action_provider import (
    onramp_action_provider,
)
from coinbase_agentkit.action_providers.onramp.schemas import GetOnrampBuyUrlSchema
from coinbase_agentkit.network import Network

MOCK_PROJECT_ID = "test-project-id"
MOCK_ADDRESS = "0x123"


def parse_url_params(url: str) -> dict:
    """Parse URL parameters into a dictionary.

    Args:
        url: URL string to parse

    Returns:
        Dictionary of parsed parameters

    """
    parsed = urlparse(url)
    # parse_qs returns values as lists, so we get the first item for single values
    return {k: v[0] for k, v in parse_qs(parsed.query).items()}


def test_get_onramp_buy_url_schema():
    """Test that the GetOnrampBuyUrlSchema validates correctly."""
    schema = GetOnrampBuyUrlSchema()
    assert isinstance(schema, GetOnrampBuyUrlSchema)


def test_get_onramp_buy_url_success(mock_wallet):
    """Test successful get_onramp_buy_url call."""
    mock_wallet.get_address.return_value = MOCK_ADDRESS
    mock_wallet.get_network.return_value = Network(
        chain_id="1", protocol_family="evm", network_id="base-mainnet"
    )

    provider = onramp_action_provider(MOCK_PROJECT_ID)
    result = provider.get_onramp_buy_url(mock_wallet, {})

    # Parse and verify URL components
    parsed = urlparse(result)
    params = parse_url_params(result)

    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == "https://pay.coinbase.com/buy"
    assert params["appId"] == MOCK_PROJECT_ID
    assert params["defaultNetwork"] == "base"
    assert params["sdkVersion"] == f"onchainkit@{VERSION}"

    # Verify address configuration
    address_config = json.loads(params["addresses"])
    assert address_config == {MOCK_ADDRESS: ["base"]}

    mock_wallet.get_network.assert_called()
    mock_wallet.get_address.assert_called()


def test_get_onramp_buy_url_unsupported_network(mock_wallet):
    """Test get_onramp_buy_url with unsupported network."""
    mock_wallet.get_network.return_value = Network(
        chain_id="1", protocol_family="evm", network_id="unsupported-network"
    )
    provider = onramp_action_provider(MOCK_PROJECT_ID)

    with pytest.raises(
        ValueError,
        match="Network ID is not supported. Make sure you are using a supported mainnet network.",
    ):
        provider.get_onramp_buy_url(mock_wallet, {})


def test_get_onramp_buy_url_missing_network_id(mock_wallet):
    """Test get_onramp_buy_url with missing network ID."""
    mock_wallet.get_network.return_value = Network(
        chain_id="1", protocol_family="evm", network_id=None
    )
    provider = onramp_action_provider(MOCK_PROJECT_ID)

    with pytest.raises(ValueError, match="Network ID is not set"):
        provider.get_onramp_buy_url(mock_wallet, {})


def test_supports_network():
    """Test network support based on protocol family."""
    provider = onramp_action_provider(MOCK_PROJECT_ID)

    # Test EVM network support
    evm_network = Network(chain_id="1", protocol_family="evm", network_id="base-mainnet")
    assert provider.supports_network(evm_network) is True

    # Test non-EVM network
    non_evm_network = Network(chain_id="1", protocol_family="solana", network_id="solana-mainnet")
    assert provider.supports_network(non_evm_network) is False
