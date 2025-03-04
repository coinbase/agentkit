"""Tests for CDP API action provider."""

import os
from unittest.mock import patch

import pytest

from coinbase_agentkit.__version__ import __version__
from coinbase_agentkit.action_providers.cdp.cdp_api_action_provider import cdp_api_action_provider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.cdp_wallet_provider import CdpProviderConfig

from .conftest import (
    MOCK_API_KEY_NAME,
    MOCK_API_KEY_PRIVATE_KEY,
)


@pytest.mark.usefixtures("mock_env")
def test_provider_init_with_env_vars(mock_cdp_imports):
    """Test provider initialization with environment variables."""
    mock_cdp, _ = mock_cdp_imports
    _ = cdp_api_action_provider()
    mock_cdp.configure.assert_called_once_with(
        api_key_name=MOCK_API_KEY_NAME,
        private_key=MOCK_API_KEY_PRIVATE_KEY,
        source="agentkit",
        source_version=__version__,
    )


def test_provider_init_with_config(mock_cdp_imports):
    """Test provider initialization with config."""
    mock_cdp, _ = mock_cdp_imports
    config = CdpProviderConfig(
        api_key_name=MOCK_API_KEY_NAME, api_key_private_key=MOCK_API_KEY_PRIVATE_KEY
    )
    _ = cdp_api_action_provider(config)
    mock_cdp.configure.assert_called_once_with(
        api_key_name=MOCK_API_KEY_NAME,
        private_key=MOCK_API_KEY_PRIVATE_KEY,
        source="agentkit",
        source_version=__version__,
    )


@pytest.mark.usefixtures("mock_env")
def test_provider_init_without_config(mock_cdp_imports):
    """Test provider initialization without config."""
    mock_cdp, _ = mock_cdp_imports
    _ = cdp_api_action_provider()
    mock_cdp.configure.assert_called_once_with(
        api_key_name=MOCK_API_KEY_NAME,
        private_key=MOCK_API_KEY_PRIVATE_KEY,
        source="agentkit",
        source_version=__version__,
    )


def test_provider_init_missing_credentials(mock_cdp_imports):
    """Test provider initialization with missing credentials falls back to configure_from_json."""
    mock_cdp, _ = mock_cdp_imports
    with patch.dict(os.environ, {}, clear=True):
        _ = cdp_api_action_provider()
        mock_cdp.configure_from_json.assert_called_once()


@pytest.mark.usefixtures("mock_env")
def test_supports_network():
    """Test network support."""
    provider = cdp_api_action_provider()
    assert provider.supports_network(Network(protocol_family="evm", chain_id="1")) is True
    assert provider.supports_network(Network(protocol_family="solana")) is True
