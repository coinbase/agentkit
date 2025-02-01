from unittest.mock import Mock

import pytest
from cdp import Transfer


@pytest.fixture
def transfer_factory():
    """Create and return a factory for Transfer Mock fixtures."""

    def _create_transfer():
        transfer_mock = Mock(spec=Transfer)
        transfer_mock.transaction_hash = "0xvalidTransactionHash"
        transfer_mock.transaction_link = "https://basescan.org/tx/0xvalidTransactionHash"

        return transfer_mock

    return _create_transfer
