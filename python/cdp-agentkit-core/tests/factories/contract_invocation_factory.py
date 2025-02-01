from unittest.mock import Mock

import pytest
from cdp import ContractInvocation, Transaction


@pytest.fixture
def contract_invocation_factory():
    """Create and return a factory for ContractInvocation Mock fixtures."""

    def _create_contract_invocation(to_amount="1"):
        contract_invocation_mock = Mock(spec=ContractInvocation)
        transaction_mock = Mock(spec=Transaction)
        transaction_mock.transaction_hash = "0xvalidTransactionHash"
        transaction_mock.transaction_link = "https://basescan.org/tx/0xvalidTransactionHash"

        contract_invocation_mock.transaction = transaction_mock

        return contract_invocation_mock

    return _create_contract_invocation
