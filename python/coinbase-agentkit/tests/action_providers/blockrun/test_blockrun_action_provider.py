"""Tests for the BlockRun action provider initialization."""

from unittest.mock import MagicMock, patch

from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
    AVAILABLE_MODELS,
    BLOCKRUN_API_URL,
    SUPPORTED_NETWORKS,
    BlockrunActionProvider,
    blockrun_action_provider,
)
from coinbase_agentkit.network import Network


def test_init_default():
    """Test initialization with defaults."""
    provider = BlockrunActionProvider()
    assert provider is not None
    assert provider._api_url == BLOCKRUN_API_URL


def test_init_with_custom_api_url():
    """Test initialization with custom API URL."""
    custom_url = "https://custom.blockrun.ai/api/v1"
    provider = BlockrunActionProvider(api_url=custom_url)
    assert provider._api_url == custom_url


def test_get_session_uses_wallet_provider(mock_wallet_provider):
    """Test that _get_session uses wallet provider's signer."""
    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_session = MagicMock()
        mock_x402_requests.return_value = mock_session

        provider = BlockrunActionProvider()
        session = provider._get_session(mock_wallet_provider)

        # Verify wallet provider's to_signer was called
        mock_wallet_provider.to_signer.assert_called_once()

        # Verify x402_requests was called with the signer
        mock_x402_requests.assert_called_once()
        assert session == mock_session


def test_supports_network_base_mainnet():
    """Test supports_network for Base Mainnet."""
    provider = BlockrunActionProvider()
    network = Network(
        name="base-mainnet",
        protocol_family="evm",
        chain_id="8453",
        network_id="base-mainnet",
    )
    assert provider.supports_network(network) is True


def test_supports_network_base_sepolia():
    """Test supports_network for Base Sepolia."""
    provider = BlockrunActionProvider()
    network = Network(
        name="base-sepolia",
        protocol_family="evm",
        chain_id="84532",
        network_id="base-sepolia",
    )
    assert provider.supports_network(network) is True


def test_supports_network_unsupported():
    """Test supports_network for unsupported network."""
    provider = BlockrunActionProvider()
    network = Network(
        name="ethereum-mainnet",
        protocol_family="evm",
        chain_id="1",
        network_id="ethereum-mainnet",
    )
    assert provider.supports_network(network) is False


def test_supports_network_non_evm():
    """Test supports_network for non-EVM network."""
    provider = BlockrunActionProvider()
    network = Network(
        name="solana-mainnet",
        protocol_family="solana",
        chain_id="",
        network_id="solana-mainnet",
    )
    assert provider.supports_network(network) is False


def test_factory_function():
    """Test the factory function."""
    provider = blockrun_action_provider()
    assert isinstance(provider, BlockrunActionProvider)
    assert provider._api_url == BLOCKRUN_API_URL


def test_factory_function_with_custom_url():
    """Test the factory function with custom API URL."""
    custom_url = "https://custom.blockrun.ai/api/v1"
    provider = blockrun_action_provider(api_url=custom_url)
    assert isinstance(provider, BlockrunActionProvider)
    assert provider._api_url == custom_url


def test_available_models():
    """Test that available models are defined correctly."""
    assert "openai/gpt-4o" in AVAILABLE_MODELS
    assert "openai/gpt-4o-mini" in AVAILABLE_MODELS
    assert "anthropic/claude-sonnet-4" in AVAILABLE_MODELS
    assert "google/gemini-2.0-flash" in AVAILABLE_MODELS
    assert "deepseek/deepseek-chat" in AVAILABLE_MODELS


def test_supported_networks():
    """Test that supported networks are defined correctly."""
    assert "base-mainnet" in SUPPORTED_NETWORKS
    assert "base-sepolia" in SUPPORTED_NETWORKS
