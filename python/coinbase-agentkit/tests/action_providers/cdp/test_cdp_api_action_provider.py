"""Tests for CDP API action provider."""


import pytest

from coinbase_agentkit.action_providers.cdp.cdp_api_action_provider import (
    CdpApiActionProvider,
    cdp_api_action_provider,
)
from coinbase_agentkit.network import Network


def test_provider_initializes():
    """Test provider initializes correctly."""
    provider = cdp_api_action_provider()
    assert isinstance(provider, CdpApiActionProvider)
    assert provider.name == "cdp_api"


@pytest.mark.usefixtures("mock_env")
def test_supports_network():
    """Test network support."""
    provider = cdp_api_action_provider()

    # Test evm network support
    assert (
        provider.supports_network(Network(protocol_family="evm", network_id="base-sepolia")) is True
    )
    assert (
        provider.supports_network(Network(protocol_family="evm", network_id="ethereum-sepolia"))
        is True
    )
    assert (
        provider.supports_network(Network(protocol_family="evm", network_id="base-mainnet"))
        is False
    )
    assert (
        provider.supports_network(Network(protocol_family="evm", network_id="ethereum-mainnet"))
        is False
    )

    # Test svm network support
    assert (
        provider.supports_network(Network(protocol_family="svm", network_id="solana-devnet"))
        is True
    )
    assert (
        provider.supports_network(Network(protocol_family="svm", network_id="solana-mainnet"))
        is False
    )

    # Test unsupported protocol
    assert provider.supports_network(Network(protocol_family="other")) is False
