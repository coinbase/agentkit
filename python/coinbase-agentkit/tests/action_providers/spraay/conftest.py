"""Test fixtures for Spraay action provider tests."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_RECIPIENT_A = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa"
MOCK_RECIPIENT_B = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb"
MOCK_TOKEN_ADDRESS = "0xCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc"
MOCK_TX_HASH = "0xmocktxhash123"
MOCK_SIGNATURE = "0x" + "11" * 32 + "22" * 32 + "1b"

# Default read_contract return values, keyed by function name.
DEFAULT_READS = {
    "feeBps": 30,
    "decimals": 6,
    "symbol": "USDC",
    "name": "USD Coin",
    "version": "2",
    "nonces": 0,
}


def make_read_contract(overrides: dict | None = None):
    """Build a read_contract side effect keyed by function name.

    The default allowance is stateful: 0 before the permit/approve lands,
    effectively unlimited afterwards. Override "allowance" for a fixed value.

    Args:
        overrides: Return values (or Exception instances to raise) per function name.

    Returns:
        Callable: The side effect for the read_contract mock.

    """
    overrides = overrides or {}
    values = {**DEFAULT_READS, **overrides}
    allowance_reads = {"count": 0}

    def _read_contract(contract_address, abi, function_name, args=None, **kwargs):
        if function_name == "allowance" and "allowance" not in overrides:
            allowance_reads["count"] += 1
            return 0 if allowance_reads["count"] == 1 else 2**255
        value = values.get(function_name)
        if isinstance(value, Exception):
            raise value
        return value

    return _read_contract


@pytest.fixture
def mock_wallet():
    """Create a mock EVM wallet provider."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_WALLET_ADDRESS
    mock.get_network.return_value = Network(
        protocol_family="evm", network_id="base-mainnet", chain_id="8453"
    )
    mock.send_transaction.return_value = MOCK_TX_HASH
    mock.wait_for_transaction_receipt.return_value = {"blockNumber": 12345}
    mock.sign_typed_data.return_value = MOCK_SIGNATURE
    mock.to_signer.return_value = Mock()
    mock.read_contract.side_effect = make_read_contract()
    return mock
