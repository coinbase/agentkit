"""Test fixtures for Onramp action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

MOCK_ADDRESS = "0x123"


@pytest.fixture
def mock_wallet():
    """Create a mock wallet provider."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    return mock
