"""Tests for the Onramp action provider."""

import json
from urllib.parse import parse_qs, urlparse

import pytest

from coinbase_agentkit.action_providers.onramp.onramp_action_provider import (
    onramp_action_provider,
)
from coinbase_agentkit.action_providers.onramp.schemas import (
    CryptoAsset,
    GetOnrampBuyUrlSchema,
)
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


def test_get_onramp_buy_url_schema_valid():
    """Test that the GetOnrampBuyUrlSchema validates correctly."""
    valid_input = {"asset": CryptoAsset.ETH}
    schema = GetOnrampBuyUrlSchema(**valid_input)
    assert schema.asset == CryptoAsset.ETH


def test_get_onramp_buy_url_schema_default():
    """Test that the GetOnrampBuyUrlSchema uses correct defaults."""
    schema = GetOnrampBuyUrlSchema()
    assert schema.asset == CryptoAsset.ETH


def test_get_onramp_buy_url_success(mock_wallet):
    """Test successful get_onramp_buy_url call."""
    mock_wallet.get_address.return_value = MOCK_ADDRESS
    mock_wallet.get_network.return_value = Network(
        chain_id="1", protocol_family="evm", network_id="base-mainnet"
    )

    provider = onramp_action_provider(MOCK_PROJECT_ID)
    result = provider.get_onramp_buy_url(mock_wallet, {"asset": "ETH"})

    # Parse and verify URL components
    parsed = urlparse(result)
    params = parse_url_params(result)

    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == "https://pay.coinbase.com/buy"
    assert params["appId"] == MOCK_PROJECT_ID
    assert params["defaultNetwork"] == "base"
    assert params["defaultAsset"] == "ETH"

    # Verify address configuration
    address_config = json.loads(params["addresses"])
    assert address_config == {MOCK_ADDRESS: ["base"]}

    mock_wallet.get_network.assert_called()
    mock_wallet.get_address.assert_called()


def test_get_onramp_buy_url_different_assets(mock_wallet):
    """Test get_onramp_buy_url with different assets."""
    mock_wallet.get_address.return_value = MOCK_ADDRESS
    mock_wallet.get_network.return_value = Network(
        chain_id="1", protocol_family="evm", network_id="base-mainnet"
    )
    provider = onramp_action_provider(MOCK_PROJECT_ID)

    # Test ETH
    eth_result = provider.get_onramp_buy_url(mock_wallet, {"asset": "ETH"})
    eth_params = parse_url_params(eth_result)
    assert eth_params["defaultAsset"] == "ETH"
    assert eth_params["defaultNetwork"] == "base"

    # Test USDC
    usdc_result = provider.get_onramp_buy_url(mock_wallet, {"asset": "USDC"})
    usdc_params = parse_url_params(usdc_result)
    assert usdc_params["defaultAsset"] == "USDC"
    assert usdc_params["defaultNetwork"] == "base"

    # Verify address configuration remains consistent
    address_config = json.loads(usdc_params["addresses"])
    assert address_config == {MOCK_ADDRESS: ["base"]}

    # Verify method calls
    mock_wallet.get_network.assert_called()
    mock_wallet.get_address.assert_called()


def test_get_onramp_buy_url_unsupported_network(mock_wallet):
    """Test get_onramp_buy_url with unsupported network."""
    mock_wallet.get_network.return_value = Network(
        chain_id="1", protocol_family="evm", network_id="unsupported-network"
    )
    provider = onramp_action_provider(MOCK_PROJECT_ID)

    with pytest.raises(ValueError, match="Network ID is not supported"):
        provider.get_onramp_buy_url(mock_wallet, {"asset": "ETH"})


def test_get_onramp_buy_url_missing_network_id(mock_wallet):
    """Test get_onramp_buy_url with missing network ID."""
    mock_wallet.get_network.return_value = Network(
        chain_id="1", protocol_family="evm", network_id=None
    )
    provider = onramp_action_provider(MOCK_PROJECT_ID)

    with pytest.raises(ValueError, match="Network ID is not set"):
        provider.get_onramp_buy_url(mock_wallet, {"asset": "ETH"})


def test_supports_network():
    """Test network support based on protocol family."""
    test_cases = [
        ("evm", True),
        ("other-protocol-family", False),
    ]

    provider = onramp_action_provider(MOCK_PROJECT_ID)
    for protocol_family, expected in test_cases:
        network = Network(chain_id="1", protocol_family=protocol_family, network_id="test-network")
        assert provider.supports_network(network) is expected

    # Test with minimal network
    network = Network(chain_id="1", protocol_family="solana", network_id="test-network")
    assert provider.supports_network(network) is False
