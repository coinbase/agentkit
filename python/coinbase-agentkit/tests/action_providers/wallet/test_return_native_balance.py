"""Tests for return native balance functionality."""

from decimal import Decimal
from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.wallet.schemas import ReturnNativeBalanceSchema
from coinbase_agentkit.action_providers.wallet.wallet_action_provider import (
    _EVM_GAS_BUDGET,
    _FALLBACK_GAS_PRICE_WEI,
    _SOL_TX_FEE_LAMPORTS,
)
from coinbase_agentkit.network import Network

from .conftest import MOCK_BALANCE

MOCK_TX_HASH = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_DESTINATION = "0x6fb9e80dDd0f5DC99D7cB38b07e8b298A57bF253"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

# max_fee_per_gas returned by mock estimate_fees()
MOCK_MAX_FEE_PER_GAS = 10_000_000_000  # 10 gwei
MOCK_GAS_COST = Decimal(_EVM_GAS_BUDGET * MOCK_MAX_FEE_PER_GAS)


def _make_evm_provider_with_fees(balance=MOCK_BALANCE):
    """Return a mock EVM wallet provider that supports estimate_fees()."""
    mock = Mock()  # no spec - we need to add estimate_fees
    mock.get_address.return_value = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    mock.get_balance.return_value = balance
    mock.get_network.return_value = Network(
        protocol_family="evm", chain_id="84532", network_id="base-sepolia"
    )
    mock.get_name.return_value = "TestWallet"
    mock.native_transfer.return_value = MOCK_TX_HASH
    # (max_priority_fee_per_gas, max_fee_per_gas) in wei
    mock.estimate_fees.return_value = (1_000_000_000, MOCK_MAX_FEE_PER_GAS)
    return mock


def test_return_native_balance_schema_valid():
    """Test that ReturnNativeBalanceSchema accepts a valid address."""
    schema = ReturnNativeBalanceSchema(to=MOCK_DESTINATION)
    assert isinstance(schema, ReturnNativeBalanceSchema)
    assert schema.to == MOCK_DESTINATION


def test_return_native_balance_schema_zero_address():
    """Test that ReturnNativeBalanceSchema rejects the zero address."""
    with pytest.raises(ValidationError, match="zero address"):
        ReturnNativeBalanceSchema(to=ZERO_ADDRESS)


def test_return_native_balance_schema_missing_to():
    """Test that ReturnNativeBalanceSchema rejects missing destination."""
    with pytest.raises(ValidationError):
        ReturnNativeBalanceSchema()


def test_return_native_balance_schema_rejects_zero_address():
    """Test that ReturnNativeBalanceSchema rejects the EVM zero address."""
    with pytest.raises(ValidationError, match="Transfer to the zero address is not allowed"):
        ReturnNativeBalanceSchema(to=EVM_ZERO_ADDRESS)


def test_return_native_balance_schema_rejects_zero_address_no_prefix():
    """Test that ReturnNativeBalanceSchema rejects the zero address without 0x prefix."""
    with pytest.raises(ValidationError, match="Transfer to the zero address is not allowed"):
        ReturnNativeBalanceSchema(to="0" * 40)


def test_return_native_balance_success_evm_with_estimate_fees(wallet_action_provider):
    """Test successful EVM balance return using estimate_fees() for gas cost."""
    mock_provider = _make_evm_provider_with_fees()

    expected_transfer_wei = MOCK_BALANCE - MOCK_GAS_COST
    expected_transfer_eth = expected_transfer_wei / Decimal(10**18)

    result = wallet_action_provider.return_native_balance(mock_provider, {"to": MOCK_DESTINATION})

    mock_provider.get_balance.assert_called_once()
    mock_provider.native_transfer.assert_called_once_with(MOCK_DESTINATION, expected_transfer_eth)
    assert "Returned" in result
    assert MOCK_DESTINATION in result
    assert MOCK_TX_HASH in result


def test_return_native_balance_success_evm_fallback_gas(wallet_action_provider, mock_wallet_provider):
    """Test EVM balance return using conservative fallback when no fee estimation is available.

    The spec=WalletProvider mock has no estimate_fees/web3/_web3 attributes, so
    _estimate_evm_gas_cost_wei() falls through to the hardcoded conservative estimate.
    """
    fallback_gas_cost = Decimal(_EVM_GAS_BUDGET * _FALLBACK_GAS_PRICE_WEI)
    expected_transfer_wei = MOCK_BALANCE - fallback_gas_cost
    expected_transfer_eth = expected_transfer_wei / Decimal(10**18)

    mock_wallet_provider.get_balance.return_value = MOCK_BALANCE
    mock_wallet_provider.native_transfer.return_value = MOCK_TX_HASH

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    mock_wallet_provider.native_transfer.assert_called_once_with(
        MOCK_DESTINATION, expected_transfer_eth
    )
    assert "Returned" in result
    assert MOCK_DESTINATION in result
    assert MOCK_TX_HASH in result


def test_return_native_balance_success_svm(wallet_action_provider, mock_wallet_provider):
    """Test successful SVM balance return subtracting the 5000-lamport fee."""
    mock_sol_balance = Decimal("1000000000")  # 1 SOL in lamports
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="svm", network_id="mainnet"
    )
    mock_wallet_provider.get_balance.return_value = mock_sol_balance
    mock_wallet_provider.native_transfer.return_value = "mock-signature"

    expected_transfer_lamports = mock_sol_balance - _SOL_TX_FEE_LAMPORTS
    expected_transfer_sol = expected_transfer_lamports / Decimal(10**9)

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    mock_wallet_provider.native_transfer.assert_called_once_with(
        MOCK_DESTINATION, expected_transfer_sol
    )
    assert "Returned" in result
    assert "SOL" in result
    assert MOCK_DESTINATION in result
    assert "mock-signature" in result


def test_return_native_balance_insufficient_evm_balance(wallet_action_provider):
    """Test that an EVM wallet with balance too low to cover gas returns an error."""
    mock_provider = _make_evm_provider_with_fees(balance=Decimal("1000"))  # tiny amount in wei

    result = wallet_action_provider.return_native_balance(mock_provider, {"to": MOCK_DESTINATION})

    assert "Error: Insufficient balance to cover gas fees" in result
    mock_provider.native_transfer.assert_not_called()


def test_return_native_balance_insufficient_svm_balance(wallet_action_provider, mock_wallet_provider):
    """Test that an SVM wallet with balance below 5000 lamports returns an error."""
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="svm", network_id="mainnet"
    )
    mock_wallet_provider.get_balance.return_value = Decimal("100")  # 100 lamports < 5000

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    assert "Error: Insufficient balance to cover transaction fee" in result
    mock_wallet_provider.native_transfer.assert_not_called()


def test_return_native_balance_transfer_error(wallet_action_provider):
    """Test error handling when native_transfer raises an exception."""
    mock_provider = _make_evm_provider_with_fees()
    error_message = "Transfer failed"
    mock_provider.native_transfer.side_effect = Exception(error_message)

    result = wallet_action_provider.return_native_balance(mock_provider, {"to": MOCK_DESTINATION})

    assert "Error during" in result
    assert error_message in result


def test_return_native_balance_get_balance_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling when get_balance raises an exception."""
    error_message = "Balance retrieval failed"
    mock_wallet_provider.get_balance.side_effect = Exception(error_message)

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    assert "Error during" in result
    assert error_message in result
