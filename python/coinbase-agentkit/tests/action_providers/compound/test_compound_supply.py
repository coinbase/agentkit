from decimal import Decimal
from unittest.mock import MagicMock, call, patch


def test_supply_action_success(compound_wallet, compound_provider):
    """Test that the supply action in CompoundActionProvider successfully supplies tokens."""
    provider = compound_provider
    # Using fixture provided addresses; input args can include them for clarity
    input_args = {
        "asset_id": "weth",
        "amount": "1",
        "comet_address": "0xComet",
        "token_address": "0xToken",
    }

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
        ) as mock_format_from_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_symbol"
        ) as mock_get_token_symbol,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.Web3"
        ) as mock_web3,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
    ):
        # Setup mocks for utility functions
        mock_get_token_decimals.return_value = 18
        atomic_amount = int(Decimal("1.0") * Decimal(10**18))
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_token_balance.return_value = atomic_amount
        # First call returns current health, second call returns new health
        mock_get_health_ratio.side_effect = [Decimal("2.0"), Decimal("3.0")]
        mock_get_token_symbol.return_value = "WETH"
        mock_format_from_decimals.return_value = "1"

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

        # Act
        result = provider.supply(compound_wallet, input_args)

        # Assert that the supply action returned the expected success message
        assert "Supplied 1 WETH to Compound" in result
        assert "Transaction hash: 0xTxHash" in result
        assert "Health ratio changed from 2.00 to 3.00" in result

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
                call({"to": "0xComet", "data": "encoded_supply_data"}),
            ]
        )


def test_supply_insufficient_balance(compound_wallet, compound_provider):
    """Test supply action when wallet has insufficient balance."""
    provider = compound_provider
    input_args = {"asset_id": "weth", "amount": "2"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_from_decimals"
        ) as mock_format_from_decimals,
    ):
        mock_get_token_decimals.return_value = 18
        supply_amount = int(Decimal("2.0") * Decimal(10**18))
        wallet_balance = int(Decimal("1.0") * Decimal(10**18))
        mock_format_amount_with_decimals.return_value = supply_amount
        mock_get_token_balance.return_value = wallet_balance
        mock_format_from_decimals.return_value = "1"

        result = provider.supply(compound_wallet, input_args)

        assert "Error: Insufficient balance" in result
        assert "You have 1, but trying to supply 2" in result


def test_supply_approval_failure(compound_wallet, compound_provider):
    """Test supply action when token approval fails."""
    provider = compound_provider
    input_args = {"asset_id": "weth", "amount": "1"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_get_token_decimals.return_value = 18
        atomic_amount = int(Decimal("1.0") * Decimal(10**18))
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_token_balance.return_value = atomic_amount * 2
        mock_get_health_ratio.return_value = Decimal("2.0")

        fake_contract = MagicMock()
        fake_contract.encode_abi.return_value = "encoded_approve_data"
        fake_eth = MagicMock()
        fake_eth.contract.return_value = fake_contract
        mock_web3.return_value.eth = fake_eth

        compound_wallet.send_transaction.side_effect = Exception("Approval failed")
        result = provider.supply(compound_wallet, input_args)

        assert "Error approving token: Approval failed" in result


def test_supply_transaction_failure(compound_wallet, compound_provider):
    """Test supply action when the supply transaction fails."""
    provider = compound_provider
    input_args = {"asset_id": "weth", "amount": "1"}

    with (
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.Web3"
        ) as mock_web3,
        patch(
            "coinbase_agentkit.action_providers.compound.compound_action_provider.get_health_ratio"
        ) as mock_get_health_ratio,
    ):
        mock_get_token_decimals.return_value = 18
        atomic_amount = int(Decimal("1.0") * Decimal(10**18))
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_token_balance.return_value = atomic_amount * 2
        mock_get_health_ratio.return_value = Decimal("2.0")

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

        def mock_send_transaction(params):
            if params["data"] == "encoded_approve_data":
                return "0xApprovalHash"
            raise Exception("Supply transaction failed")

        compound_wallet.send_transaction.side_effect = mock_send_transaction
        result = provider.supply(compound_wallet, input_args)

        assert "Error executing transaction: Supply transaction failed" in result


def test_supply_general_error(compound_wallet, compound_provider):
    """Test supply action when an unexpected error occurs."""
    provider = compound_provider
    input_args = {"asset_id": "weth", "amount": "1"}

    with patch(
        "coinbase_agentkit.action_providers.compound.compound_action_provider.get_token_decimals"
    ) as mock_get_token_decimals:
        mock_get_token_decimals.side_effect = Exception("Unexpected error occurred")

        result = provider.supply(compound_wallet, input_args)

        assert "Error supplying to Compound: Unexpected error occurred" in result
