"""Tests for return native balance functionality."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.wallet.schemas import ReturnNativeBalanceSchema
from coinbase_agentkit.network import Network

from .conftest import MOCK_BALANCE

MOCK_TX_HASH = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_DESTINATION = "0x6fb9e80dDd0f5DC99D7cB38b07e8b298A57bF253"


def test_return_native_balance_schema_valid():
    """Test that ReturnNativeBalanceSchema accepts a valid address."""
    schema = ReturnNativeBalanceSchema(to=MOCK_DESTINATION)
    assert isinstance(schema, ReturnNativeBalanceSchema)
    assert schema.to == MOCK_DESTINATION


def test_return_native_balance_schema_missing_to():
    """Test that ReturnNativeBalanceSchema rejects missing destination."""
    with pytest.raises(ValidationError):
        ReturnNativeBalanceSchema()


def test_return_native_balance_success_evm(wallet_action_provider, mock_wallet_provider):
    """Test successful return of full native balance on EVM."""
    mock_wallet_provider.get_balance.return_value = MOCK_BALANCE
    mock_wallet_provider.native_transfer.return_value = MOCK_TX_HASH

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    mock_wallet_provider.get_balance.assert_called_once()
    mock_wallet_provider.native_transfer.assert_called_once_with(
        MOCK_DESTINATION, Decimal(MOCK_BALANCE)
    )
    assert "Returned" in result
    assert MOCK_DESTINATION in result
    assert MOCK_TX_HASH in result


def test_return_native_balance_success_svm(wallet_action_provider, mock_wallet_provider):
    """Test successful return of full native balance on SVM."""
    mock_sol_balance = Decimal("1000000000")  # 1 SOL in lamports
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="svm", network_id="mainnet"
    )
    mock_wallet_provider.get_balance.return_value = mock_sol_balance
    mock_wallet_provider.native_transfer.return_value = "mock-signature"

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    mock_wallet_provider.native_transfer.assert_called_once_with(
        MOCK_DESTINATION, Decimal(mock_sol_balance)
    )
    assert "Returned" in result
    assert "SOL" in result
    assert MOCK_DESTINATION in result
    assert "mock-signature" in result


def test_return_native_balance_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling in return native balance."""
    error_message = "Transfer failed"
    mock_wallet_provider.get_balance.return_value = MOCK_BALANCE
    mock_wallet_provider.native_transfer.side_effect = Exception(error_message)

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    assert "Error during" in result
    assert error_message in result


def test_return_native_balance_get_balance_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling when get_balance fails."""
    error_message = "Balance retrieval failed"
    mock_wallet_provider.get_balance.side_effect = Exception(error_message)

    result = wallet_action_provider.return_native_balance(
        mock_wallet_provider, {"to": MOCK_DESTINATION}
    )

    assert "Error during" in result
    assert error_message in result
