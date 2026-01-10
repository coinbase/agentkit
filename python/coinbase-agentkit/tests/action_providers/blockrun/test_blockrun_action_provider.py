"""Tests for the BlockRun action provider initialization."""

import os
from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
    AVAILABLE_MODELS,
    SUPPORTED_NETWORKS,
    BlockrunActionProvider,
    blockrun_action_provider,
)
from coinbase_agentkit.network import Network


def test_init_with_wallet_key(mock_wallet_key):
    """Test initialization with wallet key."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)
    assert provider is not None
    assert provider._wallet_key == mock_wallet_key


def test_init_with_env_var(mock_wallet_key):
    """Test initialization with environment variable."""
    with patch.dict(os.environ, {"BLOCKRUN_WALLET_KEY": mock_wallet_key}):
        provider = BlockrunActionProvider()
        assert provider is not None
        assert provider._wallet_key == mock_wallet_key


def test_init_without_key():
    """Test initialization without wallet key (allowed, key needed at runtime)."""
    with patch.dict(os.environ, clear=True):
        # Should not raise - key is optional at init time
        provider = BlockrunActionProvider()
        assert provider is not None
        assert provider._wallet_key is None


def test_supports_network_base_mainnet(mock_wallet_key):
    """Test supports_network for Base Mainnet."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)
    network = Network(
        name="base-mainnet",
        protocol_family="evm",
        chain_id="8453",
        network_id="base-mainnet",
    )
    assert provider.supports_network(network) is True


def test_supports_network_base_sepolia(mock_wallet_key):
    """Test supports_network for Base Sepolia."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)
    network = Network(
        name="base-sepolia",
        protocol_family="evm",
        chain_id="84532",
        network_id="base-sepolia",
    )
    assert provider.supports_network(network) is True


def test_supports_network_unsupported(mock_wallet_key):
    """Test supports_network for unsupported network."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)
    network = Network(
        name="ethereum-mainnet",
        protocol_family="evm",
        chain_id="1",
        network_id="ethereum-mainnet",
    )
    assert provider.supports_network(network) is False


def test_supports_network_non_evm(mock_wallet_key):
    """Test supports_network for non-EVM network."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)
    network = Network(
        name="solana-mainnet",
        protocol_family="solana",
        chain_id="",
        network_id="solana-mainnet",
    )
    assert provider.supports_network(network) is False


def test_factory_function(mock_wallet_key):
    """Test the factory function."""
    provider = blockrun_action_provider(wallet_key=mock_wallet_key)
    assert isinstance(provider, BlockrunActionProvider)
    assert provider._wallet_key == mock_wallet_key


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
