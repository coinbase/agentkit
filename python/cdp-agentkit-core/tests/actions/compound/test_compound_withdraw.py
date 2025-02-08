from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.compound.constants import (
    CUSDCV3_ABI,
    CUSDCV3_MAINNET_ADDRESS,
    CUSDCV3_TESTNET_ADDRESS,
)
from cdp_agentkit_core.actions.compound.withdraw import (
    CompoundWithdrawInput,
    compound_withdraw,
)

MOCK_ASSET_ID = "usdc"
MOCK_AMOUNT = "100"  # 100 USDC
MOCK_AMOUNT_ATOMIC = "100000000"  # 100 USDC in atomic units (6 decimals)
MOCK_NETWORK_ID = "base-mainnet"
MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000001"
MOCK_DECIMALS = 6


def test_compound_withdraw_input_model_valid():
    """Test that CompoundWithdrawInput accepts valid parameters."""
    input_model = CompoundWithdrawInput(
        asset_id=MOCK_ASSET_ID,
        amount=MOCK_AMOUNT,
    )
    assert input_model.asset_id == MOCK_ASSET_ID
    assert input_model.amount == MOCK_AMOUNT


def test_compound_withdraw_input_model_missing_params():
    """Test that CompoundWithdrawInput raises error when params are missing."""
    with pytest.raises(ValueError):
        CompoundWithdrawInput()


def test_compound_withdraw_success_mainnet(wallet_factory, contract_invocation_factory, asset_factory):
    """Test successful withdrawal from Compound on mainnet."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_contract_invocation = contract_invocation_factory()
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)
    mock_asset.contract_address = MOCK_CONTRACT_ADDRESS

    with patch("cdp_agentkit_core.actions.compound.withdraw.get_health_ratio_after_withdraw", return_value=2.0), \
         patch("cdp_agentkit_core.actions.compound.withdraw.get_collateral_balance", return_value=int(MOCK_AMOUNT_ATOMIC)), \
         patch("cdp_agentkit_core.actions.compound.withdraw.Asset.fetch", return_value=mock_asset), \
         patch.object(mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC), \
         patch.object(mock_wallet, "invoke_contract", return_value=mock_contract_invocation) as mock_invoke_contract, \
         patch.object(mock_contract_invocation, "wait", return_value=mock_contract_invocation) as mock_wait:

        action_response = compound_withdraw(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )
        expected_response = (
            f"Withdrew {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()} from Compound V3.\n"
            f"Transaction hash: {mock_contract_invocation.transaction_hash}\n"
            f"Transaction link: {mock_contract_invocation.transaction_link}"
        )
        assert action_response == expected_response

        mock_invoke_contract.assert_called_once_with(
            contract_address=CUSDCV3_MAINNET_ADDRESS,
            method="withdraw",
            args={
                "asset": MOCK_CONTRACT_ADDRESS,
                "amount": MOCK_AMOUNT_ATOMIC,
            },
            abi=CUSDCV3_ABI,
        )
        mock_wait.assert_called_once_with()


def test_compound_withdraw_success_testnet(wallet_factory, contract_invocation_factory, asset_factory):
    """Test successful withdrawal from Compound on testnet."""
    mock_wallet = wallet_factory(network_id="base-sepolia")
    mock_contract_invocation = contract_invocation_factory()
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)
    mock_asset.contract_address = MOCK_CONTRACT_ADDRESS

    with patch("cdp_agentkit_core.actions.compound.withdraw.get_health_ratio_after_withdraw", return_value=2.0), \
         patch("cdp_agentkit_core.actions.compound.withdraw.get_collateral_balance", return_value=int(MOCK_AMOUNT_ATOMIC)), \
         patch("cdp_agentkit_core.actions.compound.withdraw.Asset.fetch", return_value=mock_asset), \
         patch.object(mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC), \
         patch.object(mock_wallet, "invoke_contract", return_value=mock_contract_invocation) as mock_invoke_contract, \
         patch.object(mock_contract_invocation, "wait", return_value=mock_contract_invocation) as mock_wait:

        action_response = compound_withdraw(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )
        expected_response = (
            f"Withdrew {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()} from Compound V3.\n"
            f"Transaction hash: {mock_contract_invocation.transaction_hash}\n"
            f"Transaction link: {mock_contract_invocation.transaction_link}"
        )
        assert action_response == expected_response

        mock_invoke_contract.assert_called_once_with(
            contract_address=CUSDCV3_TESTNET_ADDRESS,
            method="withdraw",
            args={
                "asset": MOCK_CONTRACT_ADDRESS,
                "amount": MOCK_AMOUNT_ATOMIC,
            },
            abi=CUSDCV3_ABI,
        )
        mock_wait.assert_called_once_with()


def test_compound_withdraw_api_error(wallet_factory, asset_factory):
    """Test Compound withdrawal when an API error occurs."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)
    mock_asset.contract_address = MOCK_CONTRACT_ADDRESS

    with patch("cdp_agentkit_core.actions.compound.withdraw.get_health_ratio_after_withdraw", return_value=2.0), \
         patch("cdp_agentkit_core.actions.compound.withdraw.get_collateral_balance", return_value=int(MOCK_AMOUNT_ATOMIC)), \
         patch("cdp_agentkit_core.actions.compound.withdraw.Asset.fetch", return_value=mock_asset), \
         patch.object(mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC), \
         patch.object(mock_wallet, "invoke_contract", side_effect=Exception("API error")):

        action_response = compound_withdraw(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )
        expected_response = f"Error withdrawing {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()} from Compound: API error"
        assert action_response == expected_response


def test_compound_withdraw_unhealthy_position(wallet_factory, asset_factory):
    """Test Compound withdrawal when it would result in an unhealthy position."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)
    mock_asset.contract_address = MOCK_CONTRACT_ADDRESS

    with patch("cdp_agentkit_core.actions.compound.withdraw.get_health_ratio_after_withdraw", return_value=0.95), \
         patch("cdp_agentkit_core.actions.compound.withdraw.get_collateral_balance", return_value=int(MOCK_AMOUNT_ATOMIC)), \
         patch("cdp_agentkit_core.actions.compound.withdraw.Asset.fetch", return_value=mock_asset), \
         patch.object(mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC):

        action_response = compound_withdraw(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )
        expected_response = (
            f"Error: Withdrawing {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()} would result in an unhealthy position. "
            f"Health ratio would be 0.95"
        )
        assert action_response == expected_response


def test_compound_withdraw_insufficient_balance(wallet_factory, asset_factory):
    """Test Compound withdrawal when there is insufficient balance."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)
    mock_asset.contract_address = MOCK_CONTRACT_ADDRESS

    # Set collateral balance to half of what we're trying to withdraw
    available_balance = int(MOCK_AMOUNT_ATOMIC) // 2

    with patch("cdp_agentkit_core.actions.compound.withdraw.get_collateral_balance", return_value=available_balance), \
         patch("cdp_agentkit_core.actions.compound.withdraw.Asset.fetch", return_value=mock_asset), \
         patch.object(mock_asset, "to_atomic_amount", return_value=MOCK_AMOUNT_ATOMIC), \
         patch.object(mock_asset, "from_atomic_amount", return_value=str(int(MOCK_AMOUNT) // 2)):

        action_response = compound_withdraw(
            mock_wallet,
            MOCK_ASSET_ID,
            MOCK_AMOUNT,
        )
        expected_response = (
            f"Error: Insufficient balance. Trying to withdraw {MOCK_AMOUNT} {MOCK_ASSET_ID.upper()}, "
            f"but only have {int(MOCK_AMOUNT) // 2} {MOCK_ASSET_ID.upper()} supplied"
        )
        assert action_response == expected_response
