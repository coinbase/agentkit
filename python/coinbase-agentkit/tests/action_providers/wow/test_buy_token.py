"""Tests for WOW buy token action."""

from unittest.mock import patch

import pytest
from pydantic_core import ValidationError

from coinbase_agentkit.action_providers.wow.constants import WOW_ABI
from coinbase_agentkit.action_providers.wow.schemas import WowBuyTokenSchema
from coinbase_agentkit.action_providers.wow.wow_action_provider import WowActionProvider

MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_AMOUNT_ETH = "100000000000000"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_WALLET_ADDRESS = "0x9876543210987654321098765432109876543210"
MOCK_TOKEN_QUOTE = "1000000000000000000"
MOCK_TX_HASH = "0xabcdef1234567890"
MOCK_RECEIPT = {"status": 1, "transactionHash": MOCK_TX_HASH}


def test_buy_token_input_model_valid():
    """Test that WowBuyTokenInput accepts valid parameters."""
    input_model = WowBuyTokenSchema(
        contract_address=MOCK_CONTRACT_ADDRESS,
        amount_eth_in_wei=MOCK_AMOUNT_ETH,
    )

    assert input_model.contract_address == MOCK_CONTRACT_ADDRESS
    assert input_model.amount_eth_in_wei == MOCK_AMOUNT_ETH


def test_buy_token_input_model_invalid_address():
    """Test that WowBuyTokenInput rejects invalid addresses."""
    with pytest.raises(ValidationError) as exc_info:
        WowBuyTokenSchema(
            contract_address="0xinvalid",
            amount_eth_in_wei=MOCK_AMOUNT_ETH,
        )
    assert "Invalid Ethereum address" in str(exc_info.value)


def test_buy_token_input_model_invalid_wei():
    """Test that WowBuyTokenInput rejects invalid wei amounts."""
    with pytest.raises(ValidationError):
        WowBuyTokenSchema(
            contract_address=MOCK_CONTRACT_ADDRESS,
            amount_eth_in_wei="1.5",
        )


def test_buy_token_input_model_missing_params():
    """Test that WowBuyTokenInput raises error when params are missing."""
    with pytest.raises(ValidationError):
        WowBuyTokenSchema()


def test_buy_token_success():
    """Test successful token purchase with valid parameters."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
        patch(
            "coinbase_agentkit.action_providers.wow.wow_action_provider.get_buy_quote",
            return_value=MOCK_TOKEN_QUOTE,
        ),
        patch(
            "coinbase_agentkit.action_providers.wow.wow_action_provider.get_has_graduated",
            return_value=False,
        ),
    ):
        mock_contract.return_value.encode_abi.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

        provider = WowActionProvider()
        args = {
            "contract_address": MOCK_CONTRACT_ADDRESS,
            "amount_eth_in_wei": MOCK_AMOUNT_ETH,
        }
        response = provider.buy_token(mock_wallet, args)

        expected_response = f"Purchased WoW ERC20 memecoin with transaction hash: {MOCK_TX_HASH}"
        assert response == expected_response

        mock_contract.assert_called_once_with(
            address=MOCK_CONTRACT_ADDRESS,
            abi=WOW_ABI,
        )

        min_tokens = int(int(MOCK_TOKEN_QUOTE) * 0.99)

        mock_contract.return_value.encode_abi.assert_called_once_with(
            "buy",
            [
                MOCK_WALLET_ADDRESS,
                MOCK_WALLET_ADDRESS,
                "0x0000000000000000000000000000000000000000",
                "",
                0,
                min_tokens,
                0,
            ],
        )

        mock_wallet.send_transaction.assert_called_once_with(
            {
                "to": MOCK_CONTRACT_ADDRESS,
                "data": "0xencoded",
                "value": int(MOCK_AMOUNT_ETH),
            }
        )

        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_buy_token_graduated_pool():
    """Test token purchase with graduated pool."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
        patch(
            "coinbase_agentkit.action_providers.wow.wow_action_provider.get_buy_quote",
            return_value=MOCK_TOKEN_QUOTE,
        ),
        patch(
            "coinbase_agentkit.action_providers.wow.wow_action_provider.get_has_graduated",
            return_value=True,
        ),
    ):
        mock_contract.return_value.encode_abi.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

        provider = WowActionProvider()
        args = {
            "contract_address": MOCK_CONTRACT_ADDRESS,
            "amount_eth_in_wei": MOCK_AMOUNT_ETH,
        }
        response = provider.buy_token(mock_wallet, args)

        expected_response = f"Purchased WoW ERC20 memecoin with transaction hash: {MOCK_TX_HASH}"
        assert response == expected_response

        min_tokens = int(int(MOCK_TOKEN_QUOTE) * 0.99)

        mock_contract.return_value.encode_abi.assert_called_once_with(
            "buy",
            [
                MOCK_WALLET_ADDRESS,
                MOCK_WALLET_ADDRESS,
                "0x0000000000000000000000000000000000000000",
                "",
                1,
                min_tokens,
                0,
            ],
        )

        mock_wallet.send_transaction.assert_called_once_with(
            {
                "to": MOCK_CONTRACT_ADDRESS,
                "data": "0xencoded",
                "value": int(MOCK_AMOUNT_ETH),
            }
        )


def test_buy_token_error():
    """Test buy_token when error occurs."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
        patch(
            "coinbase_agentkit.action_providers.wow.wow_action_provider.get_buy_quote",
            return_value=MOCK_TOKEN_QUOTE,
        ),
        patch(
            "coinbase_agentkit.action_providers.wow.wow_action_provider.get_has_graduated",
            return_value=False,
        ),
    ):
        mock_contract.return_value.encode_abi.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.send_transaction.side_effect = Exception("Transaction failed")

        provider = WowActionProvider()
        args = {
            "contract_address": MOCK_CONTRACT_ADDRESS,
            "amount_eth_in_wei": MOCK_AMOUNT_ETH,
        }
        response = provider.buy_token(mock_wallet, args)

        expected_response = "Error buying Zora Wow ERC20 memecoin: Transaction failed"
        assert response == expected_response

        mock_contract.assert_called_once_with(
            address=MOCK_CONTRACT_ADDRESS,
            abi=WOW_ABI,
        )
