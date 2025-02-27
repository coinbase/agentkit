from decimal import Decimal
from unittest.mock import MagicMock, patch


def test_borrow_action_success(compound_wallet, compound_provider):
    """Test that the borrow action in CompoundActionProvider successfully borrows USDC."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_base_token_address",
            return_value="0xBaseToken",
        ),
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_borrow"
        ) as mock_get_health_ratio_after_borrow,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.Web3"
        ) as mock_web3,
    ):
        atomic_amount = 1000000000  # 1000 USDC with 6 decimals
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_health_ratio.side_effect = [Decimal("Infinity"), Decimal("2.0")]
        mock_get_health_ratio_after_borrow.return_value = Decimal("2.0")

        fake_contract = MagicMock()
        fake_contract.encode_abi.return_value = "encoded_borrow_data"
        fake_eth = MagicMock()
        fake_eth.contract.return_value = fake_contract
        mock_web3.return_value.eth = fake_eth

        result = provider.borrow(compound_wallet, input_args)

        assert "Borrowed 1000 USDC from Compound" in result
        assert "Transaction hash: 0xTxHash" in result
        assert "Health ratio changed from Infinity to 2.00" in result

        fake_contract.encode_abi.assert_called_once_with(
            "withdraw", args=["0xBaseToken", atomic_amount]
        )
        compound_wallet.send_transaction.assert_called_once_with(
            {"to": "0xComet", "data": "encoded_borrow_data"}
        )


def test_borrow_unhealthy_position(compound_wallet, compound_provider):
    """Test borrow action when the resulting position would be unhealthy."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_borrow"
        ) as mock_get_health_ratio_after_borrow,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
    ):
        atomic_amount = 1000000000
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_health_ratio.return_value = Decimal("2.0")
        mock_get_health_ratio_after_borrow.return_value = Decimal("0.8")

        result = provider.borrow(compound_wallet, input_args)

        assert "Error: Borrowing 1000 USDC would result in an unhealthy position" in result
        assert "Health ratio would be 0.80" in result


def test_borrow_transaction_failure(compound_wallet, compound_provider):
    """Test borrow action when the transaction fails."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_borrow"
        ) as mock_get_health_ratio_after_borrow,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.Web3"
        ) as mock_web3,
    ):
        atomic_amount = 1000000000
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_health_ratio.return_value = Decimal("2.0")
        mock_get_health_ratio_after_borrow.return_value = Decimal("1.5")

        fake_contract = MagicMock()
        fake_contract.encode_abi.return_value = "encoded_borrow_data"
        fake_eth = MagicMock()
        fake_eth.contract.return_value = fake_contract
        mock_web3.return_value.eth = fake_eth

        compound_wallet.send_transaction.side_effect = Exception("Transaction failed")

        result = provider.borrow(compound_wallet, input_args)

        assert "Error executing transaction: Transaction failed" in result


def test_borrow_general_error(compound_wallet, compound_provider):
    """Test borrow action when an unexpected error occurs."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with patch(
        "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
    ) as mock_format_amount_with_decimals:
        mock_format_amount_with_decimals.side_effect = Exception("Unexpected error occurred")

        result = provider.borrow(compound_wallet, input_args)

        assert "Error borrowing from Compound: Unexpected error occurred" in result
