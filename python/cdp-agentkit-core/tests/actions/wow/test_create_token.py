from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.wow.constants import (
    GENERIC_TOKEN_METADATA_URI,
    WOW_FACTORY_ABI,
    get_factory_address,
)
from cdp_agentkit_core.actions.wow.create_token import (
    WowCreateTokenInput,
    wow_create_token,
)

MOCK_NAME = "Test Token"
MOCK_SYMBOL = "TEST"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_TOKEN_URI = "ipfs://QmY1GqprFYvojCcUEKgqHeDj9uhZD9jmYGrQTfA9vAE78J"


def test_create_token_input_model_valid():
    """Test that CreateTokenInput accepts valid parameters."""
    input_model = WowCreateTokenInput(
        name=MOCK_NAME,
        symbol=MOCK_SYMBOL,
        token_uri=MOCK_TOKEN_URI,
    )

    assert input_model.name == MOCK_NAME
    assert input_model.symbol == MOCK_SYMBOL


def test_create_token_input_model_missing_params():
    """Test that CreateTokenInput raises error when params are missing."""
    with pytest.raises(ValueError):
        WowCreateTokenInput()


def test_create_token_success(wallet_factory, contract_invocation_factory):
    """Test successful token creation with valid parameters."""
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
        action_response = wow_create_token(
            mock_wallet,
            MOCK_NAME,
            MOCK_SYMBOL,
        )

        expected_response = f"Created WoW ERC20 memecoin {MOCK_NAME} with symbol {MOCK_SYMBOL} on network {MOCK_NETWORK_ID}.\nTransaction hash for the token creation: {mock_contract_instance.transaction.transaction_hash}\nTransaction link for the token creation: {mock_contract_instance.transaction.transaction_link}"
        assert action_response == expected_response

        mock_invoke.assert_called_once_with(
            contract_address=get_factory_address(MOCK_NETWORK_ID),
            method="deploy",
            abi=WOW_FACTORY_ABI,
            args={
                "_tokenCreator": MOCK_WALLET_ADDRESS,
                "_platformReferrer": "0x0000000000000000000000000000000000000000",
                "_tokenURI": GENERIC_TOKEN_METADATA_URI,
                "_name": MOCK_NAME,
                "_symbol": MOCK_SYMBOL,
            },
        )
        mock_contract_wait.assert_called_once_with()


def test_create_token_api_error(wallet_factory):
    """Test create_token when API error occurs."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID

    with patch.object(
        mock_wallet, "invoke_contract", side_effect=Exception("API error")
    ) as mock_invoke:
        action_response = wow_create_token(
            mock_wallet,
            MOCK_NAME,
            MOCK_SYMBOL,
        )

        expected_response = "Error creating Zora Wow ERC20 memecoin API error"

        assert action_response == expected_response
        mock_invoke.assert_called_once_with(
            contract_address=get_factory_address(MOCK_NETWORK_ID),
            method="deploy",
            abi=WOW_FACTORY_ABI,
            args={
                "_tokenCreator": MOCK_WALLET_ADDRESS,
                "_platformReferrer": "0x0000000000000000000000000000000000000000",
                "_tokenURI": GENERIC_TOKEN_METADATA_URI,
                "_name": MOCK_NAME,
                "_symbol": MOCK_SYMBOL,
            },
        )


def test_create_token_with_custom_token_uri_success(wallet_factory, contract_invocation_factory):
    """Test successful token creation with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_instance = contract_invocation_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID

    mock_token_uri = "ipfs://QmWJ2tJB8jUHwhB2MtFb7Ew242bNKiw59A3fZQqxqtShkD"

    with (
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_instance
        ) as mock_invoke,
        patch.object(
            mock_contract_instance, "wait", return_value=mock_contract_instance
        ) as mock_contract_wait,
    ):
        action_response = wow_create_token(
            mock_wallet,
            MOCK_NAME,
            MOCK_SYMBOL,
            token_uri=mock_token_uri,
        )

        expected_response = f"Created WoW ERC20 memecoin {MOCK_NAME} with symbol {MOCK_SYMBOL} on network {MOCK_NETWORK_ID}.\nTransaction hash for the token creation: {mock_contract_instance.transaction.transaction_hash}\nTransaction link for the token creation: {mock_contract_instance.transaction.transaction_link}"
        assert action_response == expected_response

        mock_invoke.assert_called_once_with(
            contract_address=get_factory_address(MOCK_NETWORK_ID),
            method="deploy",
            abi=WOW_FACTORY_ABI,
            args={
                "_tokenCreator": MOCK_WALLET_ADDRESS,
                "_platformReferrer": "0x0000000000000000000000000000000000000000",
                "_tokenURI": mock_token_uri,
                "_name": MOCK_NAME,
                "_symbol": MOCK_SYMBOL,
            },
        )
        mock_contract_wait.assert_called_once_with()
