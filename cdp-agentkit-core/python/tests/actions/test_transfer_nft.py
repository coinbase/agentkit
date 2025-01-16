from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.transfer_nft import (
    TransferNftInput,
    transfer_nft,
)

MOCK_CONTRACT_ADDRESS = "0xvalidContractAddress"
MOCK_DESTINATION = "0xvalidAddress"
MOCK_TOKEN_ID = "1000"


def test_transfer_nft_input_model_valid():
    """Test that TransferNftInput accepts valid parameters."""
    input_model = TransferNftInput(
        contract_address=MOCK_CONTRACT_ADDRESS,
        token_id=MOCK_TOKEN_ID,
        destination=MOCK_DESTINATION,
    )

    assert input_model.contract_address == MOCK_CONTRACT_ADDRESS
    assert input_model.token_id == MOCK_TOKEN_ID
    assert input_model.destination == MOCK_DESTINATION


def test_transfer_nft_input_model_missing_params():
    """Test that TransferNftInput raises error when params are missing."""
    with pytest.raises(ValueError):
        TransferNftInput()


def test_transfer_nft_success(wallet_factory, contract_invocation_factory):
    """Test successful NFT transfer with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_invocation = contract_invocation_factory()

    # Set the mock wallet address
    mock_wallet.address = "0xdefaultAddress"

    # Set the mock transaction properties
    mock_contract_invocation.transaction_hash = "0xvalidTransactionHash"
    mock_contract_invocation.transaction_link = "https://basescan.org/tx/0xvalidTransactionHash"

    with (
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_invocation
        ) as mock_invoke_contract,
        patch.object(
            mock_contract_invocation, "wait", return_value=mock_contract_invocation
        ) as mock_contract_invocation_wait,
    ):
        action_response = transfer_nft(
            mock_wallet, MOCK_CONTRACT_ADDRESS, MOCK_TOKEN_ID, MOCK_DESTINATION
        )

        expected_response = f"Transferred NFT (ID: {MOCK_TOKEN_ID}) from contract {MOCK_CONTRACT_ADDRESS} to {MOCK_DESTINATION}.\nTransaction hash: {mock_contract_invocation.transaction_hash}\nTransaction link: {mock_contract_invocation.transaction_link}"
        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address=MOCK_CONTRACT_ADDRESS,
            method="transferFrom",
            args={
                "from": mock_wallet.address,
                "to": MOCK_DESTINATION,
                "tokenId": MOCK_TOKEN_ID,
            },
        )
        mock_contract_invocation_wait.assert_called_once_with()


def test_transfer_nft_api_error(wallet_factory):
    """Test NFT transfer when API error occurs."""
    mock_wallet = wallet_factory()
    mock_wallet.address = "0xdefaultAddress"  # Set the wallet address

    with patch.object(
        mock_wallet, "invoke_contract", side_effect=Exception("API error")
    ) as mock_invoke_contract:
        action_response = transfer_nft(
            mock_wallet, MOCK_CONTRACT_ADDRESS, MOCK_TOKEN_ID, MOCK_DESTINATION
        )

        expected_response = f"Error transferring the NFT (contract: {MOCK_CONTRACT_ADDRESS}, ID: {MOCK_TOKEN_ID}) from {mock_wallet.address} to {MOCK_DESTINATION}): API error"

        assert action_response == expected_response
        mock_invoke_contract.assert_called_once_with(
            contract_address=MOCK_CONTRACT_ADDRESS,
            method="transferFrom",
            args={
                "from": mock_wallet.address,
                "to": MOCK_DESTINATION,
                "tokenId": MOCK_TOKEN_ID,
            },
        )
