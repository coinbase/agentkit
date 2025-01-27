from unittest.mock import MagicMock, patch

import pytest

from coinbase_agentkit.action_providers.compound.compound_action_provider import (
    CompoundActionProvider,
)


@pytest.fixture
def wallet():
    """Fixture to create a mock wallet."""
    mock_wallet = MagicMock()
    mock_wallet.get_address.return_value = "0xWallet"
    mock_network = MagicMock()
    mock_network.network_id = 1
    mock_network.protocol_family = "evm"
    mock_wallet.network = mock_network
    mock_wallet.get_network.return_value = mock_network
    # Simulate a successful transaction
    mock_wallet.send_transaction.return_value = "0xTxHash"
    fake_receipt = MagicMock()
    fake_receipt.transaction_link = "http://example.com/tx/0xTxHash"
    mock_wallet.wait_for_transaction_receipt.return_value = fake_receipt
    # Setup read_contract to return base token address
    mock_wallet.read_contract.return_value = "0xBaseToken"
    return mock_wallet


@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
)
@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_borrow"
)
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio")
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.Web3")
def test_borrow_action_success(
    mock_web3,
    mock_get_health_ratio,
    mock_get_health_ratio_after_borrow,
    mock_format_amount_with_decimals,
    wallet,
):
    """Test that the borrow action in CompoundActionProvider successfully borrows USDC."""
    provider = CompoundActionProvider()

    # Override internal address getters to return dummy addresses
    provider._get_comet_address = lambda network: "0xComet"
    provider._get_asset_address = lambda network, asset_id: "0xToken"

    input_args = {"asset_id": "usdc", "amount": "1000"}

    # Setup mocks for utility functions
    atomic_amount = 1000000000  # 1000 USDC with 6 decimals: 1000 * 10^6
    mock_format_amount_with_decimals.return_value = atomic_amount
    mock_get_health_ratio.side_effect = [2.0, 3.0]  # Initial and final health ratios
    mock_get_health_ratio_after_borrow.return_value = 1.5  # Projected health ratio after borrow

    # Setup fake Web3 contract and its encode_abi call
    fake_contract = MagicMock()
    fake_contract.encode_abi.return_value = "encoded_borrow_data"
    fake_eth = MagicMock()
    fake_eth.contract.return_value = fake_contract
    mock_web3.return_value.eth = fake_eth

    # Act
    result = provider.borrow(wallet, input_args)

    # Assert that the borrow action returned the expected success message
    assert "Borrowed 1000 USDC from Compound" in result
    assert "Transaction hash: 0xTxHash" in result
    assert "Health ratio changed from 2.00 to 3.00" in result

    # Additional assertions to verify that contract.encode_abi was called correctly
    fake_contract.encode_abi.assert_called_once_with("withdraw", args=["0xBaseToken", atomic_amount])

    # Verify that the transaction was sent to the correct comet address with the encoded data
    wallet.send_transaction.assert_called_once_with(
        {"to": "0xComet", "data": "encoded_borrow_data"}
    )
