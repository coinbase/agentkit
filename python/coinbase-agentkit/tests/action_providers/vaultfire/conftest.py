from unittest.mock import MagicMock

import pytest

from coinbase_agentkit.action_providers.vaultfire.vaultfire_action_provider import (
    VaultfireActionProvider,
)


@pytest.fixture
def vaultfire_provider():
    """Fixture that returns a VaultfireActionProvider with default settings for testing."""
    return VaultfireActionProvider()


@pytest.fixture
def vaultfire_wallet():
    """Fixture that returns a mock wallet configured for Vaultfire actions."""
    wallet = MagicMock()
    wallet.get_address.return_value = "0x1234567890123456789012345678901234567890"
    network = MagicMock()
    network.network_id = "base-mainnet"
    network.protocol_family = "evm"
    wallet.network = network
    wallet.get_network.return_value = network
    wallet.send_transaction.return_value = "0xTxHash"
    fake_receipt = MagicMock()
    fake_receipt.transaction_link = "http://example.com/tx/0xTxHash"
    wallet.wait_for_transaction_receipt.return_value = fake_receipt
    return wallet
