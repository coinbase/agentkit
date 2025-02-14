"""Fixtures for ERC721 action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.erc721.erc721_action_provider import erc721_action_provider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider

MOCK_CONTRACT = "0x1234567890123456789012345678901234567890"
MOCK_DESTINATION = "0x9876543210987654321098765432109876543210"
MOCK_ADDRESS = "0x5555555555555555555555555555555555555555"
MOCK_TOKEN_ID = "123"
MOCK_TX_HASH = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_NETWORK = Network(protocol_family="evm", chain_id="1", network_id="ethereum-mainnet")
MOCK_RECEIPT = {"status": 1}


@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.get_network.return_value = MOCK_NETWORK
    mock.send_transaction.return_value = MOCK_TX_HASH

    mock.web3 = Mock()
    mock.web3.eth = Mock()
    mock.web3.eth.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

    mock_contract = Mock()
    mock_contract.encodeABI.return_value = "0xmocked_encoded_data"
    mock.web3.eth.contract.return_value = mock_contract

    return mock


@pytest.fixture
def provider():
    """Create an ERC721ActionProvider instance."""
    return erc721_action_provider()
