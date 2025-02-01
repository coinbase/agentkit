from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.mint_nft import (
    MintNftInput,
    mint_nft,
)

MOCK_CONTRACT_ADDRESS = "0xvalidContractAddress"
MOCK_DESTINATION = "0xvalidAddress"


def test_mint_nft_input_model_valid():
    """Test that MintNftInput accepts valid parameters."""
    input_model = MintNftInput(
        contract_address=MOCK_CONTRACT_ADDRESS,
        destination=MOCK_DESTINATION,
    )

    assert input_model.contract_address == MOCK_CONTRACT_ADDRESS
    assert input_model.destination == MOCK_DESTINATION


def test_mint_nft_input_model_missing_params():
    """Test that MintNftInput raises error when params are missing."""
    with pytest.raises(ValueError):
        MintNftInput()


def test_mint_nft_success(wallet_factory, contract_invocation_factory):
    """Test successful mint NFT with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_invocation = contract_invocation_factory()

    with (
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_invocation
        ) as mock_invoke_contract,
        patch.object(
            mock_contract_invocation, "wait", return_value=mock_contract_invocation
        ) as mock_contract_invocation_wait,
    ):
        action_response = mint_nft(mock_wallet, MOCK_CONTRACT_ADDRESS, MOCK_DESTINATION)

        expected_response = f"Minted NFT from contract {MOCK_CONTRACT_ADDRESS} to address {MOCK_DESTINATION} on network {mock_wallet.network_id}.\nTransaction hash for the mint: {mock_contract_invocation.transaction.transaction_hash}\nTransaction link for the mint: {mock_contract_invocation.transaction.transaction_link}"
        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address=MOCK_CONTRACT_ADDRESS,
            method="mint",
            args={"to": MOCK_DESTINATION, "quantity": "1"},
        )
        mock_contract_invocation_wait.assert_called_once_with()


def test_trade_api_error(wallet_factory):
    """Test mint NFT when API error occurs."""
    mock_wallet = wallet_factory()

    with patch.object(
        mock_wallet, "invoke_contract", side_effect=Exception("API error")
    ) as mock_invoke_contract:
        action_response = mint_nft(mock_wallet, MOCK_CONTRACT_ADDRESS, MOCK_DESTINATION)

        expected_response = "Error minting NFT API error"

        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address=MOCK_CONTRACT_ADDRESS,
            method="mint",
            args={"to": MOCK_DESTINATION, "quantity": "1"},
        )
