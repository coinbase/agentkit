"""Fixtures for the OSF action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.osf.osf_action_provider import osf_action_provider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider


@pytest.fixture
def provider():
    """Return an OSF action provider instance."""
    return osf_action_provider()


@pytest.fixture
def mock_wallet_provider():
    """Return a mock EVM wallet provider reporting Base mainnet."""
    wallet = Mock(spec=EvmWalletProvider)
    wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id="base-mainnet",
        chain_id="8453",
    )
    wallet.get_name.return_value = "mock_wallet"
    wallet.get_address.return_value = "0x0000000000000000000000000000000000000000"
    wallet.to_signer.return_value = Mock()
    return wallet
