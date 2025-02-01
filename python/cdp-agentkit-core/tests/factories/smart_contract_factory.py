from unittest.mock import Mock

import pytest
from cdp import SmartContract


@pytest.fixture
def smart_contract_factory():
    """Create and return a factory for Contract Mock fixtures."""

    def _create_smart_contract():
        smart_contract_mock = Mock(spec=SmartContract)
        smart_contract_mock.contract_address = "0xvalidContractAddress"
        smart_contract_mock.transaction_link = "https://basescan.org/tx/0xvalidTransactionHash"

        return smart_contract_mock

    return _create_smart_contract
