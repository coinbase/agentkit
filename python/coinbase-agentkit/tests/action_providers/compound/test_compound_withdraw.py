from unittest.mock import MagicMock, patch

import pytest

from coinbase_agentkit.action_providers.compound.compound_action_provider import (
    CompoundActionProvider,
)


@pytest.fixture
def wallet():
    """Fixture to create a mock wallet."""
    # Create a mock wallet with necessary attributes and methods
    mock_wallet = MagicMock()
    mock_wallet.address = "0xWallet"

    # Create a fake network with required attributes
    mock_network = MagicMock()
    mock_network.network_id = 1
    mock_network.protocol_family = "evm"
    mock_wallet.network = mock_network
    mock_wallet.get_network.return_value = mock_network
    mock_wallet.get_address.return_value = "0xWallet"

    # Setup send_transaction to return a dummy transaction hash
    mock_wallet.send_transaction.return_value = "0xTxHash"

    # Create a fake receipt with a transaction_link attribute
    fake_receipt = MagicMock()
    fake_receipt.transaction_link = "http://example.com/tx/0xTxHash"
    mock_wallet.wait_for_transaction_receipt.return_value = fake_receipt

    return mock_wallet


@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals")
@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
)
@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.get_collateral_balance"
)
@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
)
@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_withdraw"
)
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio")
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_symbol")
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.Web3")
def test_withdraw_action_success(
    mock_web3,
    mock_get_token_symbol,
    mock_get_health_ratio,
    mock_get_health_ratio_after_withdraw,
    mock_format_amount_from_decimals,
    mock_get_collateral_balance,
    mock_format_amount_with_decimals,
    mock_get_token_decimals,
    wallet,
):
    """Test that the withdraw action in CompoundActionProvider successfully withdraws collateral."""
    provider = CompoundActionProvider()

    # Override internal address getter methods to return dummy addresses
    provider._get_comet_address = lambda network: "0xComet"
    provider._get_asset_address = lambda network, asset_id: "0xToken"

    input_args = {"asset_id": "usdc", "amount": "1000"}

    # For USDC with 6 decimals, atomic_amount = 1000 * 10^6 = 1000000000
    token_decimals = 6
    atomic_amount = 1000000000

    # Mocks for token decimals and amount conversion
    mock_get_token_decimals.return_value = token_decimals
    mock_format_amount_with_decimals.return_value = atomic_amount

    # Set collateral balance to be sufficient (equal to atomic_amount)
    mock_get_collateral_balance.return_value = atomic_amount

    # Dummy return for format_amount_from_decimals (not used in success path)
    mock_format_amount_from_decimals.return_value = "1000"

    # Simulate a healthy projected health ratio after withdrawal
    mock_get_health_ratio_after_withdraw.return_value = 1.5

    # Simulate current and new health ratios after withdrawal
    mock_get_health_ratio.side_effect = [2.0, 3.0]

    # Simulate token symbol retrieval
    mock_get_token_symbol.return_value = "USDC"

    # Setup fake Web3 contract and its encode_abi call for the withdraw action
    fake_contract = MagicMock()
    fake_contract.encode_abi.return_value = "encoded_withdraw_data"
    fake_eth = MagicMock()
    fake_eth.contract.return_value = fake_contract
    mock_web3.return_value.eth = fake_eth

    # Act: perform the withdraw action
    result = provider.withdraw(wallet, input_args)

    # Assert that the withdraw action returned the expected success message
    assert "Withdrawn 1000 USDC from Compound" in result
    assert "Transaction hash: 0xTxHash" in result
    assert "Health ratio changed from 2.00 to 3.00" in result

    # Verify that the contract.encode_abi was called with the correct parameters
    fake_contract.encode_abi.assert_called_once_with(
        "withdraw", args=["0xToken", atomic_amount]
    )

    # Verify that the transaction was sent to the correct comet address with the encoded data
    wallet.send_transaction.assert_called_once_with(
        {"to": "0xComet", "data": "encoded_withdraw_data"}
    )
