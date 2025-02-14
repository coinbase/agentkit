"""Tests for WOW create token action."""

from unittest.mock import patch

import pytest
from pydantic_core import ValidationError

from coinbase_agentkit.action_providers.wow.constants import (
    GENERIC_TOKEN_METADATA_URI,
    WOW_FACTORY_ABI,
)
from coinbase_agentkit.action_providers.wow.schemas import WowCreateTokenSchema
from coinbase_agentkit.action_providers.wow.utils import get_factory_address
from coinbase_agentkit.action_providers.wow.wow_action_provider import WowActionProvider

MOCK_NAME = "Test Token"
MOCK_SYMBOL = "TEST"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_CHAIN_ID = "84532"
MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_TOKEN_URI = "ipfs://QmY1GqprFYvojCcUEKgqHeDj9uhZD9jmYGrQTfA9vAE78J"
MOCK_TX_HASH = "0xabcdef1234567890"
MOCK_RECEIPT = {"status": 1, "transactionHash": MOCK_TX_HASH}


def test_create_token_input_model_valid():
    """Test that WowCreateTokenInput accepts valid parameters."""
    input_model = WowCreateTokenSchema(
        name=MOCK_NAME,
        symbol=MOCK_SYMBOL,
        token_uri=MOCK_TOKEN_URI,
    )

    assert input_model.name == MOCK_NAME
    assert input_model.symbol == MOCK_SYMBOL
    assert input_model.token_uri == MOCK_TOKEN_URI


def test_create_token_input_model_missing_params():
    """Test that WowCreateTokenInput raises error when params are missing."""
    with pytest.raises(ValidationError):
        WowCreateTokenSchema()


def test_create_token_success():
    """Test successful token creation with valid parameters."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
    ):
        mock_contract.return_value.encode_abi.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.get_network.return_value.chain_id = MOCK_CHAIN_ID
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

        provider = WowActionProvider()
        args = {
            "name": MOCK_NAME,
            "symbol": MOCK_SYMBOL,
        }
        response = provider.create_token(mock_wallet, args)

        expected_response = (
            f"Created WoW ERC20 memecoin {MOCK_NAME} with symbol {MOCK_SYMBOL} "
            f"on network {MOCK_NETWORK_ID}.\n"
            f"Transaction hash for the token creation: {MOCK_TX_HASH}"
        )
        assert response == expected_response

        factory_address = get_factory_address(MOCK_CHAIN_ID)
        mock_contract.assert_called_once_with(
            address=factory_address,
            abi=WOW_FACTORY_ABI,
        )

        mock_contract.return_value.encode_abi.assert_called_once_with(
            "deploy",
            [
                MOCK_WALLET_ADDRESS,
                "0x0000000000000000000000000000000000000000",
                GENERIC_TOKEN_METADATA_URI,
                MOCK_NAME,
                MOCK_SYMBOL,
            ],
        )

        mock_wallet.send_transaction.assert_called_once_with(
            {
                "to": factory_address,
                "data": "0xencoded",
            }
        )

        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_create_token_with_custom_token_uri_success():
    """Test successful token creation with custom token URI."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
    ):
        mock_contract.return_value.encode_abi.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.get_network.return_value.chain_id = MOCK_CHAIN_ID
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

        provider = WowActionProvider()
        args = {
            "name": MOCK_NAME,
            "symbol": MOCK_SYMBOL,
            "token_uri": MOCK_TOKEN_URI,
        }
        response = provider.create_token(mock_wallet, args)

        expected_response = (
            f"Created WoW ERC20 memecoin {MOCK_NAME} with symbol {MOCK_SYMBOL} "
            f"on network {MOCK_NETWORK_ID}.\n"
            f"Transaction hash for the token creation: {MOCK_TX_HASH}"
        )
        assert response == expected_response

        factory_address = get_factory_address(MOCK_CHAIN_ID)
        mock_contract.assert_called_once_with(
            address=factory_address,
            abi=WOW_FACTORY_ABI,
        )

        mock_contract.return_value.encode_abi.assert_called_once_with(
            "deploy",
            [
                MOCK_WALLET_ADDRESS,
                "0x0000000000000000000000000000000000000000",
                MOCK_TOKEN_URI,
                MOCK_NAME,
                MOCK_SYMBOL,
            ],
        )

        mock_wallet.send_transaction.assert_called_once_with(
            {
                "to": factory_address,
                "data": "0xencoded",
            }
        )

        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_create_token_error():
    """Test create_token when error occurs."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
    ):
        mock_contract.return_value.encode_abi.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.get_network.return_value.chain_id = MOCK_CHAIN_ID
        mock_wallet.send_transaction.side_effect = Exception("Transaction failed")

        provider = WowActionProvider()
        args = {
            "name": MOCK_NAME,
            "symbol": MOCK_SYMBOL,
        }
        response = provider.create_token(mock_wallet, args)

        expected_response = "Error creating Zora Wow ERC20 memecoin: Transaction failed"
        assert response == expected_response

        factory_address = get_factory_address(MOCK_CHAIN_ID)
        mock_contract.assert_called_once_with(
            address=factory_address,
            abi=WOW_FACTORY_ABI,
        )
