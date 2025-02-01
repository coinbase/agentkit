from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.morpho.constants import METAMORPHO_ABI
from cdp_agentkit_core.actions.morpho.withdraw import (
    MorphoWithdrawInput,
    withdraw_from_morpho,
)

MOCK_VAULT_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
MOCK_ASSETS_WETH = "1000000000000000000"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"


def test_deposit_input_model_valid():
    """Test that MorphoWithdrawInput accepts valid parameters."""
    input_model = MorphoWithdrawInput(
        vault_address=MOCK_VAULT_ADDRESS,
        assets=MOCK_ASSETS_WETH,
        receiver=MOCK_WALLET_ADDRESS,
    )

    assert input_model.vault_address == MOCK_VAULT_ADDRESS
    assert input_model.assets == MOCK_ASSETS_WETH
    assert input_model.receiver == MOCK_WALLET_ADDRESS


def test_withdraw_input_model_missing_params():
    """Test that MorphoWithdrawInput raises error when params are missing."""
    with pytest.raises(ValueError):
        MorphoWithdrawInput()


def test_withdraw_success(wallet_factory, contract_invocation_factory):
    """Test successful withdraw with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_instance = contract_invocation_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID

    with (
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_instance
        ) as mock_invoke,
        patch.object(
            mock_contract_instance, "wait", return_value=mock_contract_instance
        ) as mock_contract_wait,
    ):
        action_response = withdraw_from_morpho(
            mock_wallet,
            MOCK_VAULT_ADDRESS,
            MOCK_ASSETS_WETH,
            MOCK_WALLET_ADDRESS,
        )

        expected_response = f"Withdrawn {MOCK_ASSETS_WETH} from Morpho Vault {MOCK_VAULT_ADDRESS} with transaction hash: {mock_contract_instance.transaction_hash} and transaction link: {mock_contract_instance.transaction_link}"
        assert action_response == expected_response

        mock_invoke.assert_called_once_with(
            contract_address=MOCK_VAULT_ADDRESS,
            method="withdraw",
            abi=METAMORPHO_ABI,
            args={
                "assets": MOCK_ASSETS_WETH,
                "receiver": MOCK_WALLET_ADDRESS,
                "owner": MOCK_WALLET_ADDRESS,
            },
        )
        mock_contract_wait.assert_called_once_with()


def test_withdraw_api_error(wallet_factory):
    """Test withdraw when API error occurs."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID

    with patch.object(
        mock_wallet, "invoke_contract", side_effect=Exception("API error")
    ) as mock_invoke:
        action_response = withdraw_from_morpho(
            mock_wallet,
            MOCK_VAULT_ADDRESS,
            MOCK_ASSETS_WETH,
            MOCK_WALLET_ADDRESS,
        )

        expected_response = "Error withdrawing from Morpho Vault: API error"
        assert action_response == expected_response
        mock_invoke.assert_called_once()
