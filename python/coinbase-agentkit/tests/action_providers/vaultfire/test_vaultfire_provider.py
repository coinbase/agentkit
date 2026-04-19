"""Tests for the Vaultfire action provider — network support and action discovery."""

from coinbase_agentkit.action_providers.vaultfire.vaultfire_action_provider import (
    VaultfireActionProvider,
    vaultfire_action_provider,
)
from coinbase_agentkit.network import Network


# ──────────────────────────────────────────────────
# Provider instantiation
# ──────────────────────────────────────────────────

def test_provider_creation():
    """Test that the factory function returns a VaultfireActionProvider."""
    provider = vaultfire_action_provider()
    assert isinstance(provider, VaultfireActionProvider)


def test_provider_name():
    """Test that the provider is named 'vaultfire'."""
    provider = vaultfire_action_provider()
    assert provider.name == "vaultfire"


def test_provider_has_seven_actions():
    """Test that the provider exposes exactly 7 actions."""
    provider = vaultfire_action_provider()
    action_names = {a.name for a in provider.get_actions()}
    assert len(action_names) == 7
    assert action_names == {
        "register_agent",
        "create_accountability_bond",
        "create_partnership_bond",
        "get_trust_profile",
        "get_reputation",
        "resolve_vns",
        "get_bond",
    }


# ──────────────────────────────────────────────────
# Network support
# ──────────────────────────────────────────────────

def test_supports_base_mainnet():
    """Test that Base mainnet is supported."""
    provider = vaultfire_action_provider()
    network = Network(protocol_family="evm", network_id="base-mainnet")
    assert provider.supports_network(network) is True


def test_supports_arbitrum_mainnet():
    """Test that Arbitrum mainnet is supported."""
    provider = vaultfire_action_provider()
    network = Network(protocol_family="evm", network_id="arbitrum-mainnet")
    assert provider.supports_network(network) is True


def test_supports_polygon_mainnet():
    """Test that Polygon mainnet is supported."""
    provider = vaultfire_action_provider()
    network = Network(protocol_family="evm", network_id="polygon-mainnet")
    assert provider.supports_network(network) is True


def test_supports_avalanche_mainnet():
    """Test that Avalanche mainnet is supported."""
    provider = vaultfire_action_provider()
    network = Network(protocol_family="evm", network_id="avalanche-mainnet")
    assert provider.supports_network(network) is True


def test_rejects_ethereum_mainnet():
    """Test that Ethereum mainnet is NOT supported."""
    provider = vaultfire_action_provider()
    network = Network(protocol_family="evm", network_id="ethereum-mainnet")
    assert provider.supports_network(network) is False


def test_rejects_solana():
    """Test that Solana is NOT supported (wrong protocol family)."""
    provider = vaultfire_action_provider()
    network = Network(protocol_family="solana", network_id="base-mainnet")
    assert provider.supports_network(network) is False


def test_rejects_invalid_network():
    """Test that an invalid network is NOT supported."""
    provider = vaultfire_action_provider()
    network = Network(protocol_family="invalid", network_id=None)
    assert provider.supports_network(network) is False
