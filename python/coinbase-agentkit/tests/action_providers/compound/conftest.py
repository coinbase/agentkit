from unittest.mock import MagicMock

import pytest

from coinbase_agentkit.action_providers.compound.compound_action_provider import (
    CompoundActionProvider,
)


@pytest.fixture
def compound_provider():
    """Fixture that returns a CompoundActionProvider with default settings for testing."""
    provider = CompoundActionProvider()
    provider._get_comet_address = lambda network: "0xComet"
    provider._get_asset_address = lambda network, asset_id: "0xToken"
    return provider


@pytest.fixture
def compound_wallet():
    """Fixture that returns a mock wallet configured for compound actions."""
    wallet = MagicMock()
    wallet.get_address.return_value = "0xWallet"
    network = MagicMock()
    network.network_id = 1
    network.protocol_family = "evm"
    wallet.network = network
    wallet.get_network.return_value = network
    wallet.send_transaction.return_value = "0xTxHash"
    fake_receipt = MagicMock()
    fake_receipt.transaction_link = "http://example.com/tx/0xTxHash"
    wallet.wait_for_transaction_receipt.return_value = fake_receipt
    return wallet
