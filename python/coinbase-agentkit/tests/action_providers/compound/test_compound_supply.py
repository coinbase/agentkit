from unittest.mock import MagicMock, call, patch

import pytest

from coinbase_agentkit.action_providers.compound.compound_action_provider import (
    CompoundActionProvider,
)


@pytest.fixture
def wallet():
    """Fixture to create a mock wallet."""
    # Create a mock wallet with necessary attributes and methods
    mock_wallet = MagicMock()
    mock_wallet.get_address.return_value = "0xWallet"

    # Create a fake network with required attributes
    mock_network = MagicMock()
    mock_network.network_id = 1
    mock_network.protocol_family = "evm"
    mock_wallet.network = mock_network
    mock_wallet.get_network.return_value = mock_network

    # Setup send_transaction to return a dummy transaction hash
    mock_wallet.send_transaction.return_value = "0xTxHash"

    # Create a fake receipt with a transaction_link attribute
    fake_receipt = MagicMock()
    fake_receipt.transaction_link = "http://example.com/tx/0xTxHash"
    mock_wallet.wait_for_transaction_receipt.return_value = fake_receipt

    return mock_wallet


@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
)
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_symbol")
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.Web3")
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio")
@patch("coinbase_agentkit.action_providers.morpho.morpho_action_provider.approve")
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance")
@patch(
    "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
)
@patch("coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals")
def test_supply_action_success(
    mock_get_token_decimals,
    mock_format_amount_with_decimals,
    mock_get_token_balance,
    mock_approve,
    mock_get_health_ratio,
    mock_web3,
    mock_get_token_symbol,
    mock_format_from_decimals,
    wallet,
):
    """Test that the supply action in CompoundActionProvider successfully supplies tokens."""
    # Arrange
    provider = CompoundActionProvider()

    # Override internal address getters to return dummy addresses
    comet_address = "0xComet"
    token_address = "0xToken"
    provider._get_comet_address = lambda network: comet_address
    provider._get_asset_address = lambda network, asset_id: token_address

    input_args = {
        "asset_id": "weth",
        "amount": "1",
        "comet_address": comet_address,
        "token_address": token_address,
    }

    # Setup mocks for utility functions
    mock_get_token_decimals.return_value = 18
    atomic_amount = 1000000000000000000  # 1 * 10^18
    mock_format_amount_with_decimals.return_value = atomic_amount
    mock_get_token_balance.return_value = atomic_amount
    # First call returns current health, second call returns new health
    mock_get_health_ratio.side_effect = [2.0, 3.0]
    mock_approve.return_value = "approved"

    # Setup fake Web3 contract and its encode_abi call
    fake_comet_contract = MagicMock()
    fake_comet_contract.encode_abi.return_value = "encoded_supply_data"
    fake_token_contract = MagicMock()
    fake_token_contract.encode_abi.return_value = "encoded_approve_data"

    def get_contract(address, abi):
        if address == "0xComet":
            return fake_comet_contract
        return fake_token_contract

    fake_eth = MagicMock()
    fake_eth.contract.side_effect = get_contract
    mock_web3.return_value.eth = fake_eth

    mock_get_token_symbol.return_value = "WETH"
    # This mock is not used in the success flow but provided for completeness
    mock_format_from_decimals.return_value = "1"

    # Act
    result = provider.supply(wallet, input_args)

    # Assert that the supply action returned the expected success message
    assert "Supplied 1 WETH to Compound" in result
    assert "Transaction hash: 0xTxHash" in result
    assert "Health ratio changed from 2.00 to 3.00" in result

    # Verify that contract.encode_abi was called with the correct parameters for both approve and supply
    fake_token_contract.encode_abi.assert_called_once_with("approve", args=["0xComet", atomic_amount])
    fake_comet_contract.encode_abi.assert_called_once_with("supply", args=["0xToken", atomic_amount])

    # Verify that the transaction was sent to the correct addresses with the encoded data
    assert wallet.send_transaction.call_count == 2
    wallet.send_transaction.assert_has_calls([
        call({"to": "0xToken", "data": "encoded_approve_data"}),
        call({"to": "0xComet", "data": "encoded_supply_data"})
    ])
