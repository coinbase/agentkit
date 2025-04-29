"""Tests for ETH Account Wallet Provider basic methods."""

import pytest

from coinbase_agentkit.network import Network

from .conftest import MOCK_ADDRESS, MOCK_BALANCE, MOCK_CHAIN_ID

# =========================================================
# basic methods tests
# =========================================================


def test_get_address(wallet_provider, mock_account):
    """Test get_address method."""
    assert wallet_provider.get_address() == MOCK_ADDRESS


def test_get_network(wallet_provider):
    """Test get_network method."""
    network = wallet_provider.get_network()
    assert isinstance(network, Network)
    assert network.protocol_family == "evm"
    assert network.chain_id == MOCK_CHAIN_ID


def test_get_balance(wallet_provider, mock_web3):
    """Test get_balance method."""
    balance = wallet_provider.get_balance()
    assert balance == MOCK_BALANCE
    mock_web3.return_value.eth.get_balance.assert_called_once_with(MOCK_ADDRESS)


def test_get_balance_failure(wallet_provider, mock_web3):
    """Test get_balance method when getting balance fails."""
    mock_web3.return_value.eth.get_balance.side_effect = Exception("Balance check failed")

    with pytest.raises(Exception, match="Balance check failed"):
        wallet_provider.get_balance()


def test_get_balance_with_connection_error(wallet_provider, mock_web3):
    """Test get_balance method with network connection error."""
    mock_web3.return_value.eth.get_balance.side_effect = ConnectionError("Network connection error")

    with pytest.raises(ConnectionError, match="Network connection error"):
        wallet_provider.get_balance()


def test_get_name(wallet_provider):
    """Test get_name method."""
    assert wallet_provider.get_name() == "eth_account_wallet_provider"
