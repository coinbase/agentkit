"""Tests for ETH Account Wallet Provider initialization."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.wallet_providers.eth_account_wallet_provider import (
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig,
)
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmGasConfig

from .conftest import (
    MOCK_ADDRESS,
    MOCK_CHAIN_ID,
    MOCK_NETWORK_ID,
    MOCK_RPC_URL,
)

# =========================================================
# initialization tests
# =========================================================


def test_init_with_account(mock_account, mock_web3):
    """Test initialization with account."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID",
            {MOCK_CHAIN_ID: MOCK_NETWORK_ID},
        ),
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}, id=MOCK_CHAIN_ID
                )
            },
        ),
    ):
        config = EthAccountWalletProviderConfig(account=mock_account, chain_id=MOCK_CHAIN_ID)

        provider = EthAccountWalletProvider(config)

        assert provider.account == mock_account
        assert provider.get_address() == MOCK_ADDRESS
        assert provider.get_network().chain_id == MOCK_CHAIN_ID
        assert provider._gas_limit_multiplier == 1.2


def test_init_with_custom_rpc(mock_account, mock_web3):
    """Test initialization with custom RPC URL."""
    custom_rpc = "https://custom-rpc.example.com"

    config = EthAccountWalletProviderConfig(
        account=mock_account, chain_id=MOCK_CHAIN_ID, rpc_url=custom_rpc
    )

    with patch(
        "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID",
        {MOCK_CHAIN_ID: MOCK_NETWORK_ID},
    ):
        provider = EthAccountWalletProvider(config)
        assert provider is not None

    mock_web3.HTTPProvider.assert_called_with(custom_rpc)


def test_init_with_gas_config(mock_account, mock_web3):
    """Test initialization with gas configuration."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID",
            {MOCK_CHAIN_ID: MOCK_NETWORK_ID},
        ),
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}, id=MOCK_CHAIN_ID
                )
            },
        ),
    ):
        config = EthAccountWalletProviderConfig(
            account=mock_account,
            chain_id=MOCK_CHAIN_ID,
            gas=EvmGasConfig(gas_limit_multiplier=2.0, fee_per_gas_multiplier=1.5),
        )

        provider = EthAccountWalletProvider(config)

        assert provider._gas_limit_multiplier == 2.0
        assert provider._fee_per_gas_multiplier == 1.5


def test_init_with_invalid_chain_id(mock_account, mock_web3):
    """Test initialization with invalid chain ID."""
    invalid_chain_id = "999999"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID",
            {MOCK_CHAIN_ID: MOCK_NETWORK_ID},
        ),
        pytest.raises(KeyError, match=invalid_chain_id),
    ):
        config = EthAccountWalletProviderConfig(account=mock_account, chain_id=invalid_chain_id)
        EthAccountWalletProvider(config)


def test_init_with_web3_error(mock_account, mock_web3):
    """Test initialization with Web3 connection error."""
    error_message = "Web3 connection error"
    with (
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID",
            {MOCK_CHAIN_ID: MOCK_NETWORK_ID},
        ),
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}, id=MOCK_CHAIN_ID
                )
            },
        ),
        patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.Web3",
            side_effect=Exception(error_message),
        ),
        pytest.raises(Exception, match=error_message),
    ):
        config = EthAccountWalletProviderConfig(account=mock_account, chain_id=MOCK_CHAIN_ID)
        EthAccountWalletProvider(config)
