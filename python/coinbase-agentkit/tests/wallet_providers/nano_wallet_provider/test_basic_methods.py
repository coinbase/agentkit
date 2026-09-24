"""Tests for Nano Wallet Provider basic methods."""

import pytest

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.nano_wallet_provider import (
    NanoWalletProvider,
    NanoWalletProviderConfig,
)

from .conftest import (
    DERIVED_ADDR,
    FAKE_RESULT_BALANCE,
    MOCK_ADDRESS,
    MOCK_BALANCE_XNO,
    MOCK_NETWORK_ID,
    MOCK_RPC_URL,
    TEST_SEED,
)

# =========================================================
# basic methods tests
# =========================================================


def test_get_address(wallet_provider):
    """Test get_address method."""
    assert wallet_provider.get_address() == MOCK_ADDRESS == DERIVED_ADDR


def test_get_network(wallet_provider):
    """Test get_network method."""
    network = wallet_provider.get_network()
    assert isinstance(network, Network)
    assert network.protocol_family == "xno"
    assert network.network_id == MOCK_NETWORK_ID
    assert network.chain_id is None


def test_get_balance(wallet_provider):
    """Test get_balance method (spendable balance, not receivable)."""
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
    provider = NanoWalletProvider(
        NanoWalletProviderConfig(address=MOCK_ADDRESS, seed=TEST_SEED)
    )
    assert provider._rpc_url == "https://env.nano.rpc"


def test_rpc_url_config_wins_over_env(monkeypatch):
    """Test the config RPC URL wins over the env default."""
    monkeypatch.setenv("NANO_RPC_URL", "https://env.nano.rpc")
    provider = NanoWalletProvider(
        NanoWalletProviderConfig(
            address=MOCK_ADDRESS, seed=TEST_SEED, rpc_url=MOCK_RPC_URL
        )
    )
    assert provider._rpc_url == MOCK_RPC_URL


def test_address_derived_from_seed():
    """Test the address is derived from the seed when not supplied."""
    provider = NanoWalletProvider(NanoWalletProviderConfig(seed=TEST_SEED))
    assert provider.get_address() == DERIVED_ADDR


def test_address_seed_mismatch_raises():
    """Test a seed that does not derive the configured address is rejected."""
    with pytest.raises(ValueError):
        NanoWalletProvider(
            NanoWalletProviderConfig(address=DERIVED_ADDR, seed="1" * 64)
        )


def test_no_address_no_seed_raises():
    """Test that an empty config is rejected at provider init."""
    with pytest.raises(ValueError):
        NanoWalletProvider(
            NanoWalletProviderConfig(address=None, seed=None)
        )


def test_invalid_seed_length_raises():
    """Test that a seed of the wrong length is rejected."""
    with pytest.raises(ValueError):
        NanoWalletProvider(NanoWalletProviderConfig(seed="1" * 63))
