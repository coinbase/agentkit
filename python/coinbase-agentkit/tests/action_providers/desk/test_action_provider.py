"""Tests for the DESK action provider initialization."""

import pytest

from coinbase_agentkit.action_providers.desk.desk_action_provider import (
    DeskActionProvider,
    desk_action_provider,
)
from coinbase_agentkit.network.network import arbitrum_sepolia, base


def test_init_testnet(mock_private_key, mock_sub_account_id, mock_rpc_url):
    """Test initialization with on testnet."""
    provider = desk_action_provider(
        private_key=mock_private_key,
        sub_account_id=mock_sub_account_id,
        chain_id="421614",
        rpc_url=mock_rpc_url,
    )
    assert provider is not None
    assert provider.private_key == mock_private_key
    assert provider.sub_account_id == mock_sub_account_id
    assert provider.network == "testnet"
    assert provider.rpc_url == mock_rpc_url
    assert isinstance(provider, DeskActionProvider)


def test_init_mainnet(mock_private_key, mock_sub_account_id, mock_rpc_url):
    """Test initialization with on mainnet."""
    provider = desk_action_provider(
        private_key=mock_private_key,
        sub_account_id=mock_sub_account_id,
        chain_id="8453",
        rpc_url=mock_rpc_url,
    )
    assert provider is not None
    assert provider.private_key == mock_private_key
    assert provider.sub_account_id == mock_sub_account_id
    assert provider.network == "mainnet"
    assert provider.rpc_url == mock_rpc_url


def test_init_no_custom_rpc_url_testnet(mock_private_key, mock_sub_account_id):
    """Test initialization with on testnet."""
    provider = desk_action_provider(
        private_key=mock_private_key, sub_account_id=mock_sub_account_id, chain_id="421614"
    )
    assert provider is not None
    assert provider.private_key == mock_private_key
    assert provider.sub_account_id == mock_sub_account_id
    assert provider.network == "testnet"
    assert provider.rpc_url is arbitrum_sepolia.rpc_urls["default"].http[0]


def test_init_no_custom_rpc_url_mainnet(mock_private_key, mock_sub_account_id):
    """Test initialization with on mainnet."""
    provider = desk_action_provider(
        private_key=mock_private_key, sub_account_id=mock_sub_account_id, chain_id="8453"
    )
    assert provider is not None
    assert provider.private_key == mock_private_key
    assert provider.sub_account_id == mock_sub_account_id
    assert provider.network == "mainnet"
    assert provider.rpc_url is base.rpc_urls["default"].http[0]


def test_unsupported_chain_id(mock_private_key, mock_sub_account_id, mock_rpc_url):
    """Test initialization with unsupported chain id."""
    with pytest.raises(ValueError):
        desk_action_provider(
            private_key=mock_private_key,
            sub_account_id=mock_sub_account_id,
            chain_id="1",
            rpc_url=mock_rpc_url,
        )


def test_init_missing_private_key(mock_sub_account_id, mock_rpc_url):
    """Test initialization with missing parameters."""
    with pytest.raises(TypeError):
        desk_action_provider(
            sub_account_id=mock_sub_account_id, chain_id="8453", rpc_url=mock_rpc_url
        )
