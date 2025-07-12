from unittest.mock import MagicMock

import pytest

from coinbase_agentkit.action_providers.aave.aave_action_provider import AaveActionProvider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider


@pytest.fixture
def aave_wallet():
    """Create a mock wallet provider for testing Aave action provider."""
    mock_wallet = MagicMock(spec=EvmWalletProvider)
    mock_wallet.get_address.return_value = "0x123456789abcdef"
    mock_wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id="base-mainnet",
        chain_id="8453",  # Chain ID as string, not integer
    )
    return mock_wallet


@pytest.fixture
def aave_provider():
    """Create an AaveActionProvider instance for testing."""
    return AaveActionProvider()


@pytest.fixture
def aave_fixtures():
    """Create common fixtures used in Aave tests."""
    return {
        "pool_address": "0xa238dd80c259a72e81d7e4664a9801593f98d1c5",
        "asset_addresses": {
            "weth": "0x4200000000000000000000000000000000000006",
            "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "cbeth": "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
            "wsteth": "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
        },
    }
