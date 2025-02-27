from unittest.mock import MagicMock, patch


def test_withdraw_action_success(compound_wallet, compound_provider):
    """Test that the withdraw action in CompoundActionProvider successfully withdraws collateral."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_collateral_balance"
        ) as mock_get_collateral_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
        ) as mock_format_amount_from_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_withdraw"
        ) as mock_get_health_ratio_after_withdraw,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_symbol"
        ) as mock_get_token_symbol,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.Web3"
        ) as mock_web3,
    ):
        token_decimals = 6
        atomic_amount = 1000000000
        mock_get_token_decimals.return_value = token_decimals
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_collateral_balance.return_value = atomic_amount
        mock_format_amount_from_decimals.return_value = "1000"
        mock_get_health_ratio_after_withdraw.return_value = 1.5
        mock_get_health_ratio.side_effect = [2.0, 3.0]
        mock_get_token_symbol.return_value = "USDC"

        fake_contract = MagicMock()
        fake_contract.encode_abi.return_value = "encoded_withdraw_data"
        fake_eth = MagicMock()
        fake_eth.contract.return_value = fake_contract
        mock_web3.return_value.eth = fake_eth

        result = provider.withdraw(compound_wallet, input_args)

        assert "Withdrawn 1000 USDC from Compound" in result
        assert "Transaction hash: 0xTxHash" in result
        assert "Health ratio changed from 2.00 to 3.00" in result

        fake_contract.encode_abi.assert_called_once_with(
            "withdraw", args=["0xToken", atomic_amount]
        )

        compound_wallet.send_transaction.assert_called_once_with(
            {"to": "0xComet", "data": "encoded_withdraw_data"}
        )


def test_withdraw_insufficient_collateral(compound_wallet, compound_provider):
    """Test withdraw action when there is insufficient collateral balance."""
    provider = compound_provider

    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_collateral_balance"
        ) as mock_get_collateral_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
        ) as mock_format_amount_from_decimals,
    ):
        token_decimals = 6
        withdraw_amount = 1000000000  # 1000 USDC
        collateral_balance = 500000000  # Only 500 USDC supplied

        mock_get_token_decimals.return_value = token_decimals
        mock_format_amount_with_decimals.return_value = withdraw_amount
        mock_get_collateral_balance.return_value = collateral_balance
        mock_format_amount_from_decimals.return_value = "500"

        result = provider.withdraw(compound_wallet, input_args)

        assert "Error: Insufficient balance" in result
        assert "Trying to withdraw 1000, but only have 500 supplied" in result


def test_withdraw_unhealthy_position(compound_wallet, compound_provider):
    """Test withdraw action when the resulting position would be unhealthy."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_collateral_balance"
        ) as mock_get_collateral_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_withdraw"
        ) as mock_get_health_ratio_after_withdraw,
    ):
        token_decimals = 6
        atomic_amount = 1000000000  # 1000 USDC
        mock_get_token_decimals.return_value = token_decimals
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_collateral_balance.return_value = atomic_amount * 2
        mock_get_health_ratio_after_withdraw.return_value = 0.8

        result = provider.withdraw(compound_wallet, input_args)

        assert "Error: Withdrawing 1000 would result in an unhealthy position" in result
        assert "Health ratio would be 0.80" in result


def test_withdraw_transaction_failure(compound_wallet, compound_provider):
    """Test withdraw action when the transaction fails."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_collateral_balance"
        ) as mock_get_collateral_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio_after_withdraw"
        ) as mock_get_health_ratio_after_withdraw,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.Web3"
        ) as mock_web3,
    ):
        token_decimals = 6
        atomic_amount = 1000000000
        mock_get_token_decimals.return_value = token_decimals
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_collateral_balance.return_value = atomic_amount * 2
        mock_get_health_ratio_after_withdraw.return_value = 1.5
        mock_get_health_ratio.return_value = 2.0

        fake_contract = MagicMock()
        fake_contract.encode_abi.return_value = "encoded_withdraw_data"
        fake_eth = MagicMock()
        fake_eth.contract.return_value = fake_contract
        mock_web3.return_value.eth = fake_eth

        compound_wallet.send_transaction.side_effect = Exception("Transaction failed")
        result = provider.withdraw(compound_wallet, input_args)

        assert "Error executing transaction: Transaction failed" in result


def test_withdraw_general_error(compound_wallet, compound_provider):
    """Test withdraw action when an unexpected error occurs."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with patch(
        "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
    ) as mock_get_token_decimals:
        mock_get_token_decimals.side_effect = Exception("Unexpected error occurred")

        result = provider.withdraw(compound_wallet, input_args)

        assert "Error withdrawing from Compound: Unexpected error occurred" in result
