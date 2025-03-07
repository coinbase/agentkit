"""Tests for the Hyperbolic Billing action provider initialization."""

import os
from unittest.mock import patch
import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    HyperbolicMarketplaceActionProvider,
    hyperbolic_marketplace_action_provider,
)
from coinbase_agentkit.network import Network


def test_init_with_api_key():
    """Test initialization with API key."""
    provider = HyperbolicMarketplaceActionProvider(api_key="test_key")
    assert provider is not None
    assert provider.api_key == "test_key"


def test_init_with_env_var():
    """Test initialization with environment variable."""
    with patch.dict(os.environ, {"HYPERBOLIC_API_KEY": "test_key"}):
        provider = HyperbolicMarketplaceActionProvider()
        assert provider is not None
        assert provider.api_key == "test_key"


def test_init_missing_api_key():
    """Test initialization with missing API key."""
    with patch.dict(os.environ, clear=True):
        with pytest.raises(ValueError):
            HyperbolicMarketplaceActionProvider()


def test_supports_network():
    """Test supports_network method."""
    provider = HyperbolicMarketplaceActionProvider(api_key="test_key")
    network = Network(
        name="test_network",
        protocol_family="ethereum",
        chain_id="1",
        network_id="1",
    )
    assert provider.supports_network(network) is True


def test_factory_function():
    """Test the factory function."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider.HyperbolicMarketplaceActionProvider") as mock:
        hyperbolic_marketplace_action_provider("test_key")
        mock.assert_called_once_with(api_key="test_key") 