"""Tests for CDP Wallet Provider error handling."""

from decimal import Decimal
from unittest.mock import patch

import pytest

# =========================================================
# error handling tests
# =========================================================


def test_network_error_handling(mocked_wallet_provider, mock_cdp_client, mock_web3):
    """Test handling of network errors during transactions."""
    # Test native transfer with network error
    error_msg = "Network connection error"
    mock_cdp_client.evm.send_transaction.side_effect = ConnectionError(error_msg)

    with pytest.raises(ConnectionError, match=error_msg):
        mocked_wallet_provider.native_transfer("0x1234", Decimal("0.5"))

    # Reset the mock for the next test
    mock_cdp_client.evm.send_transaction.side_effect = None

    # Test contract read error
    contract_error = "Contract read error"
    with (
        patch.object(
            mocked_wallet_provider._web3.eth,
            "contract",
            side_effect=Exception(contract_error),
        ),
        pytest.raises(Exception, match=contract_error),
    ):
        mocked_wallet_provider.read_contract(
            "0x1234",
            [
                {
                    "name": "test",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{"type": "string"}],
                }
            ],
            "test",
        )

    # Test transaction receipt timeout
    timeout_error = "Timeout waiting for receipt"
    with (
        patch.object(
            mocked_wallet_provider._web3.eth,
            "wait_for_transaction_receipt",
            side_effect=Exception(timeout_error),
        ),
        pytest.raises(Exception, match=timeout_error),
    ):
        mocked_wallet_provider.wait_for_transaction_receipt("0x1234")


def test_comprehensive_error_handling(mocked_wallet_provider, mock_cdp_client, mock_web3):
    """Test comprehensive error handling for various scenarios."""
    # Test invalid address error
    address_error = "Invalid address format"

    # Configure CDP client to raise exception for invalid addresses
    mock_cdp_client.evm.send_transaction.side_effect = ValueError(address_error)

    with pytest.raises(ValueError, match=address_error):
        mocked_wallet_provider.native_transfer("invalid_address", Decimal("1.0"))

    # Reset the mock for the next test
    mock_cdp_client.evm.send_transaction.side_effect = None

    # Test invalid ABI error
    abi_error = "Invalid ABI"
    with (
        patch.object(mock_web3.return_value.eth, "contract", side_effect=Exception(abi_error)),
        pytest.raises(Exception, match=abi_error),
    ):
        mocked_wallet_provider.read_contract("0x1234", "invalid_abi", "test")
