"""Tests for Nano Wallet Provider basic methods."""


import pytest

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.nano_wallet_provider import (
    NanoWalletProvider,
    NanoWalletProviderConfig,
)

from .conftest import (
    FAKE_RESULT_BALANCE,
    MOCK_ADDRESS,
    MOCK_BALANCE_XNO,
    MOCK_NETWORK_ID,
    MOCK_RPC_URL,
)

# =========================================================
# basic methods tests
# =========================================================


def test_get_address(wallet_provider):
    """Test get_address method."""
    assert wallet_provider.get_address() == MOCK_ADDRESS


def test_get_network(wallet_provider):
    """Test get_network method."""
    network = wallet_provider.get_network()
    assert isinstance(network, Network)
    assert network.protocol_family == "xno"
    assert network.network_id == MOCK_NETWORK_ID
    assert network.chain_id is None


def test_get_balance(wallet_provider):
    """Test get_balance method."""
    wallet_provider._rpc.return_value = {"balance": FAKE_RESULT_BALANCE}
    balance = wallet_provider.get_balance()
    assert balance == MOCK_BALANCE_XNO
    wallet_provider._rpc.assert_called_once_with("account_balance", account=MOCK_ADDRESS)


def test_get_balance_error(wallet_provider):
    """Test get_balance when the RPC returns an error."""
    wallet_provider._rpc.side_effect = RuntimeError(
        "Nano RPC error for action 'account_balance': oops"
    )
    with pytest.raises(RuntimeError, match="oops"):
        wallet_provider.get_balance()


def test_get_name(wallet_provider):
    """Test get_name method."""
    assert wallet_provider.get_name() == "nano_wallet_provider"


def test_rpc_url_default_from_env(monkeypatch):
    """Test the RPC URL falls back to NANO_RPC_URL when config omits it."""
    monkeypatch.setenv("NANO_RPC_URL", "https://env.nano.rpc")
    provider = NanoWalletProvider(NanoWalletProviderConfig(address=MOCK_ADDRESS))
    assert provider._rpc_url == "https://env.nano.rpc"


def test_rpc_url_config_wins_over_env(monkeypatch):
    """Test the config RPC URL wins over the env default."""
    monkeypatch.setenv("NANO_RPC_URL", "https://env.nano.rpc")
    provider = NanoWalletProvider(
        NanoWalletProviderConfig(address=MOCK_ADDRESS, rpc_url=MOCK_RPC_URL)
    )
    assert provider._rpc_url == MOCK_RPC_URL
