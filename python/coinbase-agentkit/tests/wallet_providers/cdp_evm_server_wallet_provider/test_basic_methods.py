"""Tests for CDP Wallet Provider basic methods."""

from decimal import Decimal

import pytest

from coinbase_agentkit.network import Network

from .conftest import MOCK_ADDRESS, MOCK_CHAIN_ID, MOCK_NETWORK_ID, MOCK_ONE_ETH_WEI

# =========================================================
# basic wallet method tests
# =========================================================


def test_get_address(mocked_wallet_provider):
    """Test get_address method."""
    assert mocked_wallet_provider.get_address() == MOCK_ADDRESS


def test_get_balance(mocked_wallet_provider, mock_web3):
    """Test get_balance method."""
    balance = mocked_wallet_provider.get_balance()
    assert balance == Decimal(MOCK_ONE_ETH_WEI)
    mock_web3.return_value.eth.get_balance.assert_called_once()


def test_get_balance_without_wallet(mocked_wallet_provider):
    """Test get_balance method when wallet is not initialized."""
    # Save the original Web3 instance
    original_web3 = mocked_wallet_provider._web3

    # Set _web3 to None to simulate uninitialized wallet
    mocked_wallet_provider._web3 = None

    # When _web3 is None, we expect an AttributeError with this specific message
    with pytest.raises(AttributeError, match="'NoneType' object has no attribute 'eth'"):
        mocked_wallet_provider.get_balance()

    # Restore the original Web3 instance
    mocked_wallet_provider._web3 = original_web3


def test_get_balance_with_connection_error(mocked_wallet_provider, mock_web3):
    """Test get_balance method with network connection error."""
    mock_web3.return_value.eth.get_balance.side_effect = ConnectionError("Network connection error")

    with pytest.raises(Exception, match="Network connection error"):
        mocked_wallet_provider.get_balance()


def test_get_name(mocked_wallet_provider):
    """Test get_name method."""
    assert mocked_wallet_provider.get_name() == "cdp_evm_server_wallet_provider"


def test_get_network(mocked_wallet_provider):
    """Test get_network method."""
    network = mocked_wallet_provider.get_network()
    assert isinstance(network, Network)
    assert network.protocol_family == "evm"
    assert network.network_id == MOCK_NETWORK_ID
    assert network.chain_id == MOCK_CHAIN_ID
