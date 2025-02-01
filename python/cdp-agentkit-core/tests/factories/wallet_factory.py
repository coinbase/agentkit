from unittest.mock import Mock

import pytest
from cdp import Wallet


@pytest.fixture
def wallet_factory():
    """Create and return a factory for Wallet Mock fixtures."""

    def _create_wallet(
        network_id="base-sepolia",
        wallet_id="test-wallet-id",
        default_address="0xdefaultAddress",
    ):
        wallet_mock = Mock(spec=Wallet)
        wallet_mock.id = wallet_id
        wallet_mock.network_id = network_id
        wallet_mock.default_address.address_id = default_address

        return wallet_mock

    return _create_wallet
