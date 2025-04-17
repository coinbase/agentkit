from decimal import Decimal
from unittest.mock import MagicMock, patch

from coinbase_agentkit.network import Network


def test_supply_action_success(aave_wallet, aave_provider):
    """Test that the supply action in AaveActionProvider successfully supplies tokens."""
    provider = aave_provider
    # Using fixture provided addresses
    input_args = {"asset_id": "weth", "amount": "1", "referral_code": 0, "on_behalf_of": None}

    with (
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.format_amount_from_decimals"
        ) as mock_format_from_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_symbol"
        ) as mock_get_token_symbol,
        patch("coinbase_agentkit.action_providers.aave.aave_action_provider.Web3") as mock_web3,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_health_factor"
        ) as mock_get_health_factor,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.approve_token"
        ) as mock_approve_token,
    ):
        # Setup mocks for utility functions
        mock_get_token_decimals.return_value = 18
        atomic_amount = int(Decimal("1.0") * Decimal(10**18))
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_token_balance.return_value = atomic_amount * 2  # Ensure sufficient balance
        # First call returns current health, second call returns new health
        mock_get_health_factor.side_effect = [Decimal("2.0"), Decimal("3.0")]
        mock_get_token_symbol.return_value = "WETH"
        mock_format_from_decimals.return_value = "1"
        mock_approve_token.return_value = "0xapprove_tx_hash"

        # Setup Web3 mock
        mock_contract = MagicMock()
        mock_contract.encode_abi.return_value = "encoded_supply_data"
        mock_web3.return_value.eth.contract.return_value = mock_contract
        mock_web3.to_checksum_address.side_effect = lambda addr: addr

        # Setup wallet mock for transaction
        aave_wallet.send_transaction.return_value = "0xtx_hash"

        # Call the supply action
        result = provider.supply(aave_wallet, input_args)

        # Verify the result
        assert "Successfully supplied" in result
        assert "WETH" in result
        assert "0xtx_hash" in result
        assert "Health factor changed from 2.00 to 3.00" in result

        # Verify the transaction was sent
        aave_wallet.send_transaction.assert_called_once()
        aave_wallet.wait_for_transaction_receipt.assert_called_once_with("0xtx_hash")


def test_supply_unsupported_network(aave_wallet, aave_provider):
    """Test supply action when network is not supported."""
    # Change the network to an unsupported one
    aave_wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id="ethereum-mainnet",
        chain_id="1",
    )

    input_args = {
        "asset_id": "weth",
        "amount": "1",
        "referral_code": 0,
    }

    result = aave_provider.supply(aave_wallet, input_args)

    assert "Error: Network ethereum-mainnet is not supported" in result


def test_supply_invalid_asset(aave_wallet, aave_provider):
    """Test supply action with an invalid asset ID."""
    input_args = {
        "asset_id": "invalid_asset",
        "amount": "1",
        "referral_code": 0,
    }

    result = aave_provider.supply(aave_wallet, input_args)

    # The error message could reference Pydantic validation or our custom error
    assert "invalid_asset" in result and "Error" in result


def test_supply_token_contract_error(aave_wallet, aave_provider):
    """Test supply action when there's an error with the token contract."""
    input_args = {
        "asset_id": "usdc",
        "amount": "10",
        "referral_code": 0,
    }

    with patch(
        "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_decimals"
    ) as mock_get_token_decimals:
        # Simulate error with token contract
        mock_get_token_decimals.side_effect = Exception("Contract not accessible")

        result = aave_provider.supply(aave_wallet, input_args)

        assert "Error: Could not get token information for usdc on base-mainnet" in result
        assert "token contract may not be properly deployed or accessible" in result


def test_supply_insufficient_balance(aave_wallet, aave_provider):
    """Test supply action when wallet has insufficient balance."""
    input_args = {
        "asset_id": "weth",
        "amount": "5",
        "referral_code": 0,
    }

    with (
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.format_amount_from_decimals"
        ) as mock_format_from_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
    ):
        # Setup mocks for utility functions
        mock_get_token_decimals.return_value = 18
        requested_amount = int(Decimal("5.0") * Decimal(10**18))
        wallet_amount = int(Decimal("2.0") * Decimal(10**18))
        mock_format_amount_with_decimals.return_value = requested_amount
        mock_get_token_balance.return_value = wallet_amount
        mock_format_from_decimals.return_value = "2"

        result = aave_provider.supply(aave_wallet, input_args)

        assert "Error: Insufficient balance" in result
        assert "You have 2 weth, but trying to supply 5" in result


def test_supply_balance_check_error(aave_wallet, aave_provider):
    """Test supply action when there's an error checking the balance."""
    input_args = {
        "asset_id": "usdc",
        "amount": "10",
        "referral_code": 0,
    }

    with (
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
    ):
        # Setup mocks for utility functions
        mock_get_token_decimals.return_value = 6
        requested_amount = int(Decimal("10.0") * Decimal(10**6))
        mock_format_amount_with_decimals.return_value = requested_amount
        # Simulate error checking balance
        mock_get_token_balance.side_effect = Exception(
            "Could not transact with/call contract function"
        )

        result = aave_provider.supply(aave_wallet, input_args)

        assert "Error: Could not check balance for usdc on base-mainnet" in result
        assert "token contract may not be properly deployed or accessible" in result


def test_supply_approval_error(aave_wallet, aave_provider):
    """Test supply action when token approval fails."""
    input_args = {
        "asset_id": "weth",
        "amount": "1",
        "referral_code": 0,
    }

    with (
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.approve_token"
        ) as mock_approve_token,
    ):
        # Setup mocks for utility functions
        mock_get_token_decimals.return_value = 18
        atomic_amount = int(Decimal("1.0") * Decimal(10**18))
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_token_balance.return_value = atomic_amount * 2  # Ensure sufficient balance
        # Simulate approval error
        mock_approve_token.side_effect = Exception("Approval failed")

        result = aave_provider.supply(aave_wallet, input_args)

        assert "Error approving token for Aave: Approval failed" in result


def test_supply_transaction_error_contract_issue(aave_wallet, aave_provider):
    """Test supply action when the transaction fails due to contract issues."""
    input_args = {
        "asset_id": "usdc",
        "amount": "10",
        "referral_code": 0,
    }

    with (
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_balance"
        ) as mock_get_token_balance,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.format_amount_with_decimals"
        ) as mock_format_amount_with_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.get_token_decimals"
        ) as mock_get_token_decimals,
        patch(
            "coinbase_agentkit.action_providers.aave.aave_action_provider.approve_token"
        ) as mock_approve_token,
        patch("coinbase_agentkit.action_providers.aave.aave_action_provider.Web3") as mock_web3,
    ):
        # Setup mocks for utility functions
        mock_get_token_decimals.return_value = 6
        atomic_amount = int(Decimal("10.0") * Decimal(10**6))
        mock_format_amount_with_decimals.return_value = atomic_amount
        mock_get_token_balance.return_value = atomic_amount * 2  # Ensure sufficient balance
        mock_approve_token.return_value = "0xapprove_tx_hash"

        # Setup Web3 mock
        mock_contract = MagicMock()
        mock_contract.encode_abi.return_value = "encoded_supply_data"
        mock_web3.return_value.eth.contract.return_value = mock_contract
        mock_web3.to_checksum_address.side_effect = lambda addr: addr

        # Simulate transaction error related to contract deployment
        aave_wallet.send_transaction.side_effect = Exception(
            "Could not transact with/call contract function, is contract deployed correctly"
        )

        result = aave_provider.supply(aave_wallet, input_args)

        assert "Error: Could not supply usdc to Aave on base-mainnet" in result
        assert "token may not be properly supported by Aave on this network" in result


def test_supply_generic_error(aave_wallet, aave_provider):
    """Test supply action when an unexpected error occurs."""
    input_args = {
        "asset_id": "weth",
        "amount": "1",
        "referral_code": 0,
    }

    with patch.object(aave_provider, "_get_pool_address") as mock_get_pool_address:
        # Simulate a generic error
        mock_get_pool_address.side_effect = Exception("Unexpected error")

        result = aave_provider.supply(aave_wallet, input_args)

        assert "Error: Could not get Aave Pool address" in result
