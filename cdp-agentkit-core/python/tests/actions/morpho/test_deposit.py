from decimal import Decimal
from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.morpho.constants import METAMORPHO_ABI
from cdp_agentkit_core.actions.morpho.deposit import (
    MorphoDepositInput,
    deposit_to_morpho,
)

MOCK_VAULT_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
MOCK_ASSETS_WETH = "1000000000000000000"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_TOKEN_ADDRESS = "0x4200000000000000000000000000000000000006"
MOCK_DECIMALS = 18
MOCK_ASSETS = "1"
MOCK_ASSETS_WEI = "1000000000000000000"


def test_deposit_input_model_valid():
    """Test that MorphoDepositInput accepts valid parameters."""
    input_model = MorphoDepositInput(
        vault_address=MOCK_VAULT_ADDRESS,
        assets=MOCK_ASSETS_WETH,
        receiver=MOCK_WALLET_ADDRESS,
        token_address=MOCK_TOKEN_ADDRESS,
    )

    assert input_model.vault_address == MOCK_VAULT_ADDRESS
    assert input_model.assets == MOCK_ASSETS_WETH
    assert input_model.receiver == MOCK_WALLET_ADDRESS
    assert input_model.token_address == MOCK_TOKEN_ADDRESS


def test_deposit_input_model_missing_params():
    """Test that MorphoDepositInput raises error when params are missing."""
    with pytest.raises(ValueError):
        MorphoDepositInput()


def test_deposit_success(wallet_factory, contract_invocation_factory, asset_factory):
    """Test successful deposit with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_instance = contract_invocation_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with (
        patch(
            "cdp_agentkit_core.actions.morpho.deposit.approve", return_value="Approval successful"
        ) as mock_approve,
        patch(
            "cdp_agentkit_core.actions.morpho.deposit.Asset.fetch", return_value=mock_asset
        ) as mock_get_asset,
        patch.object(
            mock_asset, "to_atomic_amount", return_value=MOCK_ASSETS_WEI
        ) as mock_to_atomic_amount,
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_instance
        ) as mock_invoke,
        patch.object(
            mock_contract_instance, "wait", return_value=mock_contract_instance
        ) as mock_contract_wait,
    ):
        action_response = deposit_to_morpho(
            mock_wallet,
            MOCK_VAULT_ADDRESS,
            MOCK_ASSETS,
            MOCK_WALLET_ADDRESS,
            MOCK_TOKEN_ADDRESS,
        )

        expected_response = f"Deposited {MOCK_ASSETS} to Morpho Vault {MOCK_VAULT_ADDRESS} with transaction hash: {mock_contract_instance.transaction_hash} and transaction link: {mock_contract_instance.transaction_link}"
        assert action_response == expected_response

        mock_approve.assert_called_once_with(
            mock_wallet, MOCK_TOKEN_ADDRESS, MOCK_VAULT_ADDRESS, MOCK_ASSETS_WEI
        )

        mock_get_asset.assert_called_once_with(MOCK_NETWORK_ID, MOCK_TOKEN_ADDRESS)

        mock_to_atomic_amount.assert_called_once_with(Decimal(MOCK_ASSETS))

        mock_invoke.assert_called_once_with(
            contract_address=MOCK_VAULT_ADDRESS,
            method="deposit",
            abi=METAMORPHO_ABI,
            args={"assets": MOCK_ASSETS_WEI, "receiver": MOCK_WALLET_ADDRESS},
        )
        mock_contract_wait.assert_called_once_with()


def test_deposit_api_error(wallet_factory, asset_factory):
    """Test deposit when API error occurs."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with (
        patch(
            "cdp_agentkit_core.actions.morpho.deposit.approve", return_value="Approval successful"
        ),
        patch(
            "cdp_agentkit_core.actions.morpho.deposit.Asset.fetch", return_value=mock_asset
        ) as mock_get_asset,
        patch.object(
            mock_asset, "to_atomic_amount", return_value=MOCK_ASSETS_WEI
        ) as mock_to_atomic_amount,
        patch.object(mock_wallet, "invoke_contract", side_effect=Exception("API error")),
    ):
        action_response = deposit_to_morpho(
            mock_wallet,
            MOCK_VAULT_ADDRESS,
            MOCK_ASSETS,  # Using non-wei value
            MOCK_WALLET_ADDRESS,
            MOCK_TOKEN_ADDRESS,
        )

        expected_response = "Error depositing to Morpho Vault: API error"
        assert action_response == expected_response

        mock_get_asset.assert_called_once_with(MOCK_NETWORK_ID, MOCK_TOKEN_ADDRESS)

        mock_to_atomic_amount.assert_called_once_with(Decimal(MOCK_ASSETS))


def test_deposit_approval_failure(wallet_factory, asset_factory):
    """Test deposit when approval fails."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID
    mock_asset = asset_factory(decimals=MOCK_DECIMALS)

    with (
        patch(
            "cdp_agentkit_core.actions.morpho.deposit.approve",
            return_value="Error: Approval failed",
        ) as mock_approve,
        patch(
            "cdp_agentkit_core.actions.morpho.deposit.Asset.fetch", return_value=mock_asset
        ) as mock_get_asset,
        patch.object(
            mock_asset, "to_atomic_amount", return_value=MOCK_ASSETS_WEI
        ) as mock_to_atomic_amount,
    ):
        action_response = deposit_to_morpho(
            mock_wallet,
            MOCK_VAULT_ADDRESS,
            MOCK_ASSETS,  # Using non-wei value
            MOCK_WALLET_ADDRESS,
            MOCK_TOKEN_ADDRESS,
        )

        expected_response = "Error approving Morpho Vault as spender: Error: Approval failed"
        assert action_response == expected_response

        mock_approve.assert_called_once_with(
            mock_wallet, MOCK_TOKEN_ADDRESS, MOCK_VAULT_ADDRESS, MOCK_ASSETS_WEI
        )

        mock_get_asset.assert_called_once_with(MOCK_NETWORK_ID, MOCK_TOKEN_ADDRESS)

        mock_to_atomic_amount.assert_called_once_with(Decimal(MOCK_ASSETS))
