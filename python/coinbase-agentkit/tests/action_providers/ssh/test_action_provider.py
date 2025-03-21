"""Tests for SshActionProvider basic functionality.

This module tests the initialization and basic functionality of the SshActionProvider,
while specific action tests have been moved to their respective files.
"""

from coinbase_agentkit.action_providers.ssh.ssh_action_provider import SshActionProvider


def test_initialization(ssh_provider):
    """Test provider initialization."""
    assert isinstance(ssh_provider, SshActionProvider)
    assert ssh_provider.name == "ssh"


def test_supports_all_networks(ssh_provider):
    """Test that the provider supports all networks."""
    networks = ["ethereum", "bitcoin", "ethereum_sepolia", "polygon"]
    for network in networks:
        assert ssh_provider.supports_network(network) is True
