"""Fixtures for Basename action provider tests."""

from unittest.mock import Mock

import pytest
from web3 import Web3

from coinbase_agentkit.action_providers.basename.basename_action_provider import (
    basename_action_provider,
)
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider

MOCK_ADDRESS = Web3.to_checksum_address("0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83")
MOCK_TX_HASH = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_BASENAME = "test"
MOCK_AMOUNT = "0.01"
MOCK_RECEIPT = {"status": 1}


@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.send_transaction.return_value = MOCK_TX_HASH
    mock.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

    mock.get_network.return_value = Network(
        protocol_family="evm", chain_id="8453", network_id="base-mainnet"
    )

    return mock


@pytest.fixture
def provider():
    """Create a BasenameActionProvider instance."""
    return basename_action_provider()
