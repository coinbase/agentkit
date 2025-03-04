"""Test fixtures for ERC20 action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

MOCK_AMOUNT = "1000000000000000000"
MOCK_DECIMALS = 6
MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_DESTINATION = "0x9876543210987654321098765432109876543210"
MOCK_ADDRESS = "0x1234567890123456789012345678901234567890"


@pytest.fixture
def mock_wallet():
    """Create a mock wallet provider."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.read_contract.side_effect = [int(MOCK_AMOUNT), MOCK_DECIMALS]
    return mock
