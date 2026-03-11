"""Test fixtures for Etherscan action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

# Fixture constants
MOCK_API_KEY = "TEST_API_KEY_12345"
MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_SOURCE_CODE = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract MyToken {}"
MOCK_CONTRACT_NAME = "MyToken"
MOCK_COMPILER_VERSION = "v0.8.20+commit.a1b79de6"
MOCK_GUID = "abc123def456"
MOCK_NETWORK_ID = "ethereum-mainnet"
MOCK_CHAIN_ID = "1"
MOCK_API_URL = "https://api.etherscan.io/api"


@pytest.fixture
def mock_wallet():
    """Create a mock EVM wallet provider pointing at Ethereum mainnet."""
    wallet = Mock(spec=EvmWalletProvider)
    network = Network(
        protocol_family="evm",
        network_id=MOCK_NETWORK_ID,
        chain_id=MOCK_CHAIN_ID,
    )
    wallet.get_network.return_value = network
    wallet.get_address.return_value = "0xWalletAddress"
    return wallet
