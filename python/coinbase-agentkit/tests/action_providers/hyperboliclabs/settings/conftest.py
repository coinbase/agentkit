"""Test fixtures for Hyperbolic settings service."""

import secrets

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.settings.action_provider import (
    SettingsActionProvider,
)


@pytest.fixture
def provider(mock_api_key):
    """Create a HyperbolicSettingsActionProvider with a mock API key.

    Args:
        mock_api_key: Mock API key for authentication.

    Returns:
        HyperbolicSettingsActionProvider: Provider with mock API key.

    """
    return SettingsActionProvider(api_key=mock_api_key)


@pytest.fixture
def random_eth_address():
    """Generate a random Ethereum address for testing.

    Returns:
        str: A random Ethereum address with 0x prefix.

    """
    return "0x" + secrets.token_hex(20)
