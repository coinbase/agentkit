"""Test fixtures for ERC20 action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.erc20.utils import TokenDetails
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

MOCK_AMOUNT = "1000000000000000000"
MOCK_DECIMALS = 6
MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_DESTINATION = "0x9876543210987654321098765432109876543210"
MOCK_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_SPENDER = "0xabcdef1234567890123456789012345678901234"
MOCK_TOKEN_NAME = "MockToken"


def create_token_details(
    name: str = MOCK_TOKEN_NAME, decimals: int = MOCK_DECIMALS, balance: int = int(MOCK_AMOUNT)
):
    """Create mock token details.

    Args:
        name: Token name
        decimals: Token decimals
        balance: Token balance in atomic units

    Returns:
        TokenDetails object

    """
    formatted_balance = str(balance / (10**decimals))
    return TokenDetails(
        name=name, decimals=decimals, balance=balance, formatted_balance=formatted_balance
    )


@pytest.fixture
def mock_wallet():
    """Create a mock wallet provider."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    return mock
