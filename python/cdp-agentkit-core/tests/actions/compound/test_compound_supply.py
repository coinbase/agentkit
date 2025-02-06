from decimal import Decimal
from unittest.mock import Mock, patch

import pytest

from cdp_agentkit_core.actions.compound.constants import (
    CUSDCV3_ABI,
    CUSDCV3_MAINNET_ADDRESS,
    CUSDCV3_TESTNET_ADDRESS,
)
from cdp_agentkit_core.actions.compound.supply import (
    CompoundSupplyInput,
    compound_supply,
)

MOCK_ASSET_ID = "usdc"
MOCK_AMOUNT = "100"  # Human readable amount
MOCK_AMOUNT_ATOMIC = "100000000"  # 100 USDC in atomic units (6 decimals)
MOCK_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000001"
MOCK_DECIMALS = 6


def test_compound_supply_input_model_valid():
    """Test that CompoundSupplyInput accepts valid parameters."""
    input_model = CompoundSupplyInput(
        asset_id=MOCK_ASSET_ID,
        amount=MOCK_AMOUNT,
    )

    assert input_model.asset_id == MOCK_ASSET_ID
    assert input_model.amount == MOCK_AMOUNT


def test_compound_supply_input_model_missing_params():
    """Test that CompoundSupplyInput raises error when params are missing."""
    with pytest.raises(ValueError):
        CompoundSupplyInput()


def test_compound_supply_success_mainnet(wallet_factory, contract_invocation_factory, asset_factory):
    """Test successful supply to Compound on mainnet."""
    mock_wallet = wallet_factory(network_id="base-mainnet")
    mock_wallet.default_address.balance = Mock(return_value="200")  # More than MOCK_AMOUNT
    mock_contract_invocation = contract_invocation_factory()
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with (
        patch("cdp.Asset.fetch", return_value=mock_asset) as mock_asset_fetch,
        patch.object(
            mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC
        ) as mock_to_atomic_amount,
        patch(
            "cdp_agentkit_core.actions.compound.supply.approve",
            return_value="Approval successful"
        ) as mock_approve,
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_invocation
        ) as mock_invoke_contract,
        patch.object(
            mock_contract_invocation, "wait", return_value=mock_contract_invocation
        ) as mock_contract_invocation_wait,
    ):
        action_response = compound_supply(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )

        expected_response = f"Supplied {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()} to Compound V3.\nTransaction hash: {mock_contract_invocation.transaction_hash}\nTransaction link: {mock_contract_invocation.transaction_link}"
        assert action_response == expected_response

        mock_wallet.default_address.balance.assert_called_once_with(MOCK_ASSET_ID)
        mock_asset_fetch.assert_called_once_with(mock_wallet.network_id, MOCK_ASSET_ID)
        mock_to_atomic_amount.assert_called_once_with(Decimal(MOCK_AMOUNT))
        mock_approve.assert_called_once_with(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            CUSDCV3_MAINNET_ADDRESS,
            MOCK_AMOUNT_ATOMIC
        )
        mock_invoke_contract.assert_called_once_with(
            contract_address=CUSDCV3_MAINNET_ADDRESS,
            method="supply",
            args={
                "asset": MOCK_CONTRACT_ADDRESS,
                "amount": MOCK_AMOUNT_ATOMIC,
            },
            abi=CUSDCV3_ABI,
        )
        mock_contract_invocation_wait.assert_called_once_with()


def test_compound_supply_success_testnet(wallet_factory, contract_invocation_factory, asset_factory):
    """Test successful supply to Compound on testnet."""
    mock_wallet = wallet_factory(network_id="base-sepolia")
    mock_wallet.default_address.balance = Mock(return_value="200")  # More than MOCK_AMOUNT
    mock_contract_invocation = contract_invocation_factory()
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with (
        patch("cdp.Asset.fetch", return_value=mock_asset) as mock_asset_fetch,
        patch.object(
            mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC
        ) as mock_to_atomic_amount,
        patch(
            "cdp_agentkit_core.actions.compound.supply.approve",
            return_value="Approval successful"
        ) as mock_approve,
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_invocation
        ) as mock_invoke_contract,
        patch.object(
            mock_contract_invocation, "wait", return_value=mock_contract_invocation
        ) as mock_contract_invocation_wait,
    ):
        action_response = compound_supply(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )

        expected_response = f"Supplied {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()} to Compound V3.\nTransaction hash: {mock_contract_invocation.transaction_hash}\nTransaction link: {mock_contract_invocation.transaction_link}"
        assert action_response == expected_response

        mock_wallet.default_address.balance.assert_called_once_with(MOCK_ASSET_ID)
        mock_asset_fetch.assert_called_once_with(mock_wallet.network_id, MOCK_ASSET_ID)
        mock_to_atomic_amount.assert_called_once_with(Decimal(MOCK_AMOUNT))
        mock_approve.assert_called_once_with(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            CUSDCV3_TESTNET_ADDRESS,
            MOCK_AMOUNT_ATOMIC
        )
        mock_invoke_contract.assert_called_once_with(
            contract_address=CUSDCV3_TESTNET_ADDRESS,
            method="supply",
            args={
                "asset": MOCK_CONTRACT_ADDRESS,
                "amount": MOCK_AMOUNT_ATOMIC,
            },
            abi=CUSDCV3_ABI,
        )
        mock_contract_invocation_wait.assert_called_once_with()


def test_compound_supply_approval_failure(wallet_factory, asset_factory):
    """Test supply when approval fails."""
    mock_wallet = wallet_factory(network_id="base-mainnet")
    mock_wallet.default_address.balance = Mock(return_value="200")  # More than MOCK_AMOUNT
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with (
        patch("cdp.Asset.fetch", return_value=mock_asset) as mock_asset_fetch,
        patch.object(
            mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC
        ) as mock_to_atomic_amount,
        patch(
            "cdp_agentkit_core.actions.compound.supply.approve",
            return_value="Error: Approval failed"
        ) as mock_approve,
    ):
        action_response = compound_supply(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )

        expected_response = "Error approving Compound as spender: Error: Approval failed"
        assert action_response == expected_response

        mock_wallet.default_address.balance.assert_called_once_with(MOCK_ASSET_ID)
        mock_asset_fetch.assert_called_once_with(mock_wallet.network_id, MOCK_ASSET_ID)
        mock_to_atomic_amount.assert_called_once_with(Decimal(MOCK_AMOUNT))
        mock_approve.assert_called_once_with(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            CUSDCV3_MAINNET_ADDRESS,
            MOCK_AMOUNT_ATOMIC
        )


def test_compound_supply_api_error(wallet_factory, asset_factory):
    """Test supply when API error occurs."""
    mock_wallet = wallet_factory(network_id="base-mainnet")
    mock_wallet.default_address.balance = Mock(return_value="200")  # More than MOCK_AMOUNT
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with (
        patch("cdp.Asset.fetch", return_value=mock_asset) as mock_asset_fetch,
        patch.object(
            mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC
        ) as mock_to_atomic_amount,
        patch(
            "cdp_agentkit_core.actions.compound.supply.approve",
            return_value="Approval successful"
        ) as mock_approve,
        patch.object(
            mock_wallet, "invoke_contract", side_effect=Exception("API error")
        ) as mock_invoke_contract,
    ):
        action_response = compound_supply(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )

        expected_response = f"Error supplying {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()} to Compound: API error"
        assert action_response == expected_response

        mock_wallet.default_address.balance.assert_called_once_with(MOCK_ASSET_ID)
        mock_asset_fetch.assert_called_once_with(mock_wallet.network_id, MOCK_ASSET_ID)
        mock_to_atomic_amount.assert_called_once_with(Decimal(MOCK_AMOUNT))
        mock_approve.assert_called_once_with(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            CUSDCV3_MAINNET_ADDRESS,
            MOCK_AMOUNT_ATOMIC
        )
        mock_invoke_contract.assert_called_once_with(
            contract_address=CUSDCV3_MAINNET_ADDRESS,
            method="supply",
            args={
                "asset": MOCK_CONTRACT_ADDRESS,
                "amount": MOCK_AMOUNT_ATOMIC,
            },
            abi=CUSDCV3_ABI,
        )


def test_compound_supply_insufficient_balance(wallet_factory, asset_factory):
    """Test supply when wallet has insufficient balance."""
    mock_wallet = wallet_factory(network_id="base-mainnet")
    mock_wallet.default_address.balance = Mock(return_value="50")  # Less than MOCK_AMOUNT of 100
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with patch("cdp.Asset.fetch", return_value=mock_asset):
        action_response = compound_supply(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )

        expected_response = f"Error: Insufficient balance. You have 50 {MOCK_ASSET_ID.upper()}, but trying to supply {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()}"
        assert action_response == expected_response
        mock_wallet.default_address.balance.assert_called_once_with(MOCK_ASSET_ID)

