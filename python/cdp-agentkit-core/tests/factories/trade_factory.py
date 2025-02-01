from unittest.mock import Mock

import pytest
from cdp import Trade, Transaction


@pytest.fixture
def trade_factory():
    """Create and return a factory for Trade Mock fixtures."""

    def _create_trade(to_amount="1"):
        trade_mock = Mock(spec=Trade)
        transaction_mock = Mock(spec=Transaction)
        transaction_mock.transaction_hash = "0xvalidTransactionHash"
        transaction_mock.transaction_link = "https://basescan.org/tx/0xvalidTransactionHash"

        trade_mock.transaction = transaction_mock
        trade_mock.to_amount = to_amount

        return trade_mock

    return _create_trade
