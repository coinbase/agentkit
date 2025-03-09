"""Tests for the Hyperbolic Settings action provider initialization."""

import os
from unittest.mock import patch
import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.settings.action_provider import (
    HyperbolicSettingsActionProvider,
    hyperbolic_settings_action_provider,
)
from coinbase_agentkit.network import Network


def test_init_with_api_key(api_key):
    """Test initialization with API key."""
    provider = HyperbolicSettingsActionProvider(api_key=api_key)
    assert provider is not None
    assert provider.api_key == api_key


def test_init_with_env_var(api_key):
    """Test initialization with environment variable."""
    with patch.dict(os.environ, {"HYPERBOLIC_API_KEY": api_key}):
        provider = HyperbolicSettingsActionProvider()
        assert provider is not None
        assert provider.api_key == api_key


def test_init_missing_api_key():
    """Test initialization with missing API key."""
    with patch.dict(os.environ, clear=True):
        with pytest.raises(ValueError):
            HyperbolicSettingsActionProvider()


def test_supports_network(api_key):
    """Test supports_network method."""
    provider = HyperbolicSettingsActionProvider(api_key=api_key)
    network = Network(
        name="test_network",
        protocol_family="ethereum",
        chain_id="1",
        network_id="1",
    )
    assert provider.supports_network(network) is True


def test_factory_function(api_key):
    """Test the factory function."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.settings.action_provider.HyperbolicSettingsActionProvider") as mock:
        hyperbolic_settings_action_provider(api_key)
        mock.assert_called_once_with(api_key=api_key) 