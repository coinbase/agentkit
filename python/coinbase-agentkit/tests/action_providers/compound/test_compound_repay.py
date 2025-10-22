from unittest.mock import MagicMock, call, patch


def test_repay_action_success(compound_wallet, compound_provider):
    """Test that the repay action in CompoundActionProvider successfully repays debt."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
        ) as mock_format_amount_from_decimals,
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
        mock_get_token_balance.return_value = atomic_amount
        mock_get_token_decimals.return_value = token_decimals
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_format_amount_from_decimals.return_value = "1000"
        mock_get_health_ratio.side_effect = [1.5, 2.5]
        mock_get_token_symbol.return_value = "USDC"

        fake_comet_contract = MagicMock()
        fake_comet_contract.encode_abi.return_value = "encoded_repay_data"
        fake_token_contract = MagicMock()
        fake_token_contract.encode_abi.return_value = "encoded_approve_data"

        def get_contract(address, abi):
            if address == "0xComet":
                return fake_comet_contract
            return fake_token_contract

        fake_eth = MagicMock()
        fake_eth.contract.side_effect = get_contract
        mock_web3.return_value.eth = fake_eth

        result = provider.repay(compound_wallet, input_args)

        assert "Repaid 1000 USDC to Compound" in result
        assert "Transaction hash: 0xTxHash" in result
        assert "Health ratio improved from 1.50 to 2.50" in result

        fake_token_contract.encode_abi.assert_called_once_with(
            "approve", args=["0xComet", atomic_amount]
        )
        fake_comet_contract.encode_abi.assert_called_once_with(
            "supply", args=["0xToken", atomic_amount]
        )

        assert compound_wallet.send_transaction.call_count == 2
        compound_wallet.send_transaction.assert_has_calls(
            [
                call({"to": "0xToken", "data": "encoded_approve_data"}),
                call({"to": "0xComet", "data": "encoded_repay_data"}),
            ]
        )


def test_repay_insufficient_balance(compound_wallet, compound_provider):
    """Test repay action when wallet has insufficient balance."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
        ) as mock_format_amount_from_decimals,
    ):
        token_decimals = 6
        repay_amount = 1000000000
        wallet_balance = 500000000

        mock_get_token_decimals.return_value = token_decimals
        mock_format_amount_with_decimals.return_value = repay_amount
        mock_get_token_balance.return_value = wallet_balance
        mock_format_amount_from_decimals.return_value = "500"

        result = provider.repay(compound_wallet, input_args)

        assert "Error: Insufficient balance" in result
        assert "You have 500, but trying to repay 1000" in result


def test_repay_approval_failure(compound_wallet, compound_provider):
    """Test repay action when token approval fails."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
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
        mock_get_token_balance.return_value = atomic_amount * 2
        mock_get_health_ratio.return_value = 1.5

        fake_contract = MagicMock()
        fake_contract.encode_abi.return_value = "encoded_approve_data"
        fake_eth = MagicMock()
        fake_eth.contract.return_value = fake_contract
        mock_web3.return_value.eth = fake_eth

        compound_wallet.send_transaction.side_effect = Exception("Approval failed")

        result = provider.repay(compound_wallet, input_args)

        assert "Error approving token: Approval failed" in result


def test_repay_transaction_failure(compound_wallet, compound_provider):
    """Test repay action when the repay transaction fails."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
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
        mock_get_token_balance.return_value = atomic_amount * 2
        mock_get_health_ratio.return_value = 1.5

        fake_comet_contract = MagicMock()
        fake_comet_contract.encode_abi.return_value = "encoded_repay_data"
        fake_token_contract = MagicMock()
        fake_token_contract.encode_abi.return_value = "encoded_approve_data"

        def get_contract(address, abi):
            if address == "0xComet":
                return fake_comet_contract
            return fake_token_contract

        fake_eth = MagicMock()
        fake_eth.contract.side_effect = get_contract
        mock_web3.return_value.eth = fake_eth

        def mock_send_transaction(params):
            if params["data"] == "encoded_approve_data":
                return "0xApprovalHash"
            raise Exception("Repay transaction failed")

        compound_wallet.send_transaction.side_effect = mock_send_transaction

        result = provider.repay(compound_wallet, input_args)

        assert "Error executing transaction: Repay transaction failed" in result


def test_repay_general_error(compound_wallet, compound_provider):
    """Test repay action when an unexpected error occurs."""
    provider = compound_provider
    input_args = {"asset_id": "usdc", "amount": "1000"}

    with patch(
        "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
    ) as mock_get_token_decimals:
        mock_get_token_decimals.side_effect = Exception("Unexpected error occurred")

        result = provider.repay(compound_wallet, input_args)

        assert "Error repaying to Compound: Unexpected error occurred" in result
