import pytest

from coinbase_agentkit.action_providers.hyperlane.constants import DESTINATION_DOMAINS
from coinbase_agentkit.network import Network


def test_supports_network(hyperlane_provider):
    """The provider supports EVM origin chains in SUPPORTED_NETWORKS."""
    supported = [
        Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453"),
        Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1"),
        Network(protocol_family="evm", network_id="optimism-mainnet", chain_id="10"),
        Network(protocol_family="evm", network_id="arbitrum-mainnet", chain_id="42161"),
    ]
    unsupported = [
        Network(protocol_family="evm", network_id="base-sepolia", chain_id="84532"),
        Network(protocol_family="evm", network_id="polygon-mainnet", chain_id="137"),
        Network(protocol_family="svm", network_id="solana-mainnet", chain_id="101"),
    ]
    for network in supported:
        assert hyperlane_provider.supports_network(network)
    for network in unsupported:
        assert not hyperlane_provider.supports_network(network)


def test_get_destination_domain_known(hyperlane_provider):
    """_get_destination_domain returns the canonical Hyperlane domain ID for known chains."""
    assert hyperlane_provider._get_destination_domain("ethereum") == 1
    assert hyperlane_provider._get_destination_domain("optimism") == 10
    assert hyperlane_provider._get_destination_domain("base") == 8453
    assert hyperlane_provider._get_destination_domain("arbitrum") == 42161


def test_get_destination_domain_case_insensitive(hyperlane_provider):
    """Destination chain name matching is case-insensitive and trims whitespace."""
    assert hyperlane_provider._get_destination_domain("Ethereum") == 1
    assert hyperlane_provider._get_destination_domain(" OPTIMISM ") == 10


def test_get_destination_domain_unknown(hyperlane_provider):
    """An unknown destination raises ValueError listing supported chains."""
    with pytest.raises(ValueError) as exc:
        hyperlane_provider._get_destination_domain("nowhere")
    assert "Unsupported destination" in str(exc.value)


def test_destination_domains_match_chain_ids():
    """Sanity check: domain IDs in our table match the canonical Hyperlane registry values."""
    expected = {
        "ethereum": 1,
        "optimism": 10,
        "bsc": 56,
        "polygon": 137,
        "base": 8453,
        "arbitrum": 42161,
    }
    for chain, domain in expected.items():
        assert DESTINATION_DOMAINS[chain] == domain
