"""Tests for CDP Wallet Provider basic methods."""

from decimal import Decimal
from unittest.mock import patch

import pytest

from coinbase_agentkit.network import Network

from .conftest import MOCK_ADDRESS, MOCK_CHAIN_ID, MOCK_NETWORK_ID, MOCK_ONE_ETH_WEI

# =========================================================
# basic wallet method tests
# =========================================================


def test_get_address(mocked_wallet_provider):
    """Test get_address method."""
    assert mocked_wallet_provider.get_address() == MOCK_ADDRESS


def test_get_balance(mocked_wallet_provider, mock_wallet):
    """Test get_balance method."""
    provider_wallet = mocked_wallet_provider._wallet
    provider_wallet.balance.return_value = 2.0

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_wei",
        return_value=2 * MOCK_ONE_ETH_WEI,
    ):
        balance = mocked_wallet_provider.get_balance()
        assert balance == Decimal(2 * MOCK_ONE_ETH_WEI)
        provider_wallet.balance.assert_called_once_with("eth")


def test_get_balance_without_wallet(mocked_wallet_provider):
    """Test get_balance method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.get_balance()


def test_get_balance_with_connection_error(mocked_wallet_provider, mock_wallet):
    """Test get_balance method with network connection error."""
    mock_wallet.balance.side_effect = ConnectionError("Network connection error")

    with pytest.raises(
        Exception, match="Failed to transfer native tokens|Network connection error"
    ):
        mocked_wallet_provider.get_balance()


def test_get_name(mocked_wallet_provider):
    """Test get_name method."""
    assert mocked_wallet_provider.get_name() == "cdp_wallet_provider"


def test_get_network(mocked_wallet_provider):
    """Test get_network method."""
    network = mocked_wallet_provider.get_network()
    assert isinstance(network, Network)
    assert network.protocol_family == "evm"
    assert network.network_id == MOCK_NETWORK_ID
    assert network.chain_id == MOCK_CHAIN_ID
