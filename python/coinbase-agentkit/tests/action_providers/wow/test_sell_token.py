"""Tests for WOW sell token action."""
import json
from unittest.mock import patch

import pytest
from pydantic_core import ValidationError

from coinbase_agentkit.action_providers.wow.constants import WOW_ABI
from coinbase_agentkit.action_providers.wow.schemas import WowSellTokenInput
from coinbase_agentkit.action_providers.wow.wow_action_provider import WowActionProvider

MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_AMOUNT_TOKENS = "100000000000000"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_WALLET_ADDRESS = "0x9876543210987654321098765432109876543210"
MOCK_ETH_QUOTE = "1000000000000000000"  # 1 ETH
MOCK_TX_HASH = "0xabcdef1234567890"
MOCK_RECEIPT = {"status": 1, "transactionHash": MOCK_TX_HASH}


def test_sell_token_input_model_valid():
    """Test that WowSellTokenInput accepts valid parameters."""
    input_model = WowSellTokenInput(
        contract_address=MOCK_CONTRACT_ADDRESS,
        amount_tokens_in_wei=MOCK_AMOUNT_TOKENS,
    )

    assert input_model.contract_address == MOCK_CONTRACT_ADDRESS
    assert input_model.amount_tokens_in_wei == MOCK_AMOUNT_TOKENS


def test_sell_token_input_model_invalid_address():
    """Test that WowSellTokenInput rejects invalid addresses."""
    with pytest.raises(ValidationError) as exc_info:
        WowSellTokenInput(
            contract_address="0xinvalid",
            amount_tokens_in_wei=MOCK_AMOUNT_TOKENS,
        )
    assert "Invalid Ethereum address" in str(exc_info.value)


def test_sell_token_input_model_invalid_wei():
    """Test that WowSellTokenInput rejects invalid wei amounts."""
    with pytest.raises(ValidationError):
        WowSellTokenInput(
            contract_address=MOCK_CONTRACT_ADDRESS,
            amount_tokens_in_wei="1.5",  # Wei amounts can't have decimals
        )


def test_sell_token_input_model_missing_params():
    """Test that WowSellTokenInput raises error when params are missing."""
    with pytest.raises(ValidationError):
        WowSellTokenInput()


def test_sell_token_success():
    """Test successful token sale with valid parameters."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.get_sell_quote", return_value=MOCK_ETH_QUOTE),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.get_has_graduated", return_value=False),
    ):
        # Set up mocks
        mock_contract.return_value.encodeABI.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

        # Create provider and call sell_token
        provider = WowActionProvider()
        args = {
            "contract_address": MOCK_CONTRACT_ADDRESS,
            "amount_tokens_in_wei": MOCK_AMOUNT_TOKENS,
        }
        response = provider.sell_token(mock_wallet, args)

        expected_response = (
            f"Sold WoW ERC20 memecoin with transaction hash: {MOCK_TX_HASH}, "
            f"and receipt:\n{json.dumps(MOCK_RECEIPT)}"
        )
        assert response == expected_response

        # Verify contract calls
        mock_contract.assert_called_once_with(
            address=MOCK_CONTRACT_ADDRESS,
            abi=WOW_ABI,
        )

        # Calculate expected minimum ETH (98% of quote for slippage protection)
        min_eth = int(int(MOCK_ETH_QUOTE) * 98 / 100)

        # Verify function encoding
        mock_contract.return_value.encodeABI.assert_called_once_with(
            fn_name="sell",
            args=[
                int(MOCK_AMOUNT_TOKENS),
                MOCK_WALLET_ADDRESS,
                "0x0000000000000000000000000000000000000000",
                "",
                0,  # not graduated
                min_eth,
                0,
            ],
        )

        # Verify transaction parameters
        mock_wallet.send_transaction.assert_called_once_with({
            "to": MOCK_CONTRACT_ADDRESS,
            "data": "0xencoded",
        })

        # Verify receipt wait
        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_sell_token_graduated_pool():
    """Test token sale with graduated pool."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.get_sell_quote", return_value=MOCK_ETH_QUOTE),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.get_has_graduated", return_value=True),
    ):
        # Set up mocks
        mock_contract.return_value.encodeABI.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT

        # Create provider and call sell_token
        provider = WowActionProvider()
        args = {
            "contract_address": MOCK_CONTRACT_ADDRESS,
            "amount_tokens_in_wei": MOCK_AMOUNT_TOKENS,
        }
        response = provider.sell_token(mock_wallet, args)

        expected_response = (
            f"Sold WoW ERC20 memecoin with transaction hash: {MOCK_TX_HASH}, "
            f"and receipt:\n{json.dumps(MOCK_RECEIPT)}"
        )
        assert response == expected_response

        # Calculate expected minimum ETH (98% of quote for slippage protection)
        min_eth = int(int(MOCK_ETH_QUOTE) * 98 / 100)

        # Verify function encoding with graduated=1
        mock_contract.return_value.encodeABI.assert_called_once_with(
            fn_name="sell",
            args=[
                int(MOCK_AMOUNT_TOKENS),
                MOCK_WALLET_ADDRESS,
                "0x0000000000000000000000000000000000000000",
                "",
                1,  # graduated
                min_eth,
                0,
            ],
        )

        # Verify transaction parameters
        mock_wallet.send_transaction.assert_called_once_with({
            "to": MOCK_CONTRACT_ADDRESS,
            "data": "0xencoded",
        })


def test_sell_token_error():
    """Test sell_token when error occurs."""
    with (
        patch("web3.eth.Eth.contract") as mock_contract,
        patch("web3.Web3.to_checksum_address", side_effect=lambda x: x),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.wallet_providers.EvmWalletProvider") as mock_wallet,
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.get_sell_quote", return_value=MOCK_ETH_QUOTE),
        patch("coinbase_agentkit.action_providers.wow.wow_action_provider.get_has_graduated", return_value=False),
    ):
        # Set up mocks
        mock_contract.return_value.encodeABI.return_value = "0xencoded"
        mock_web3.to_checksum_address.side_effect = lambda x: x
        mock_web3.return_value.eth.contract = mock_contract
        mock_wallet.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_wallet.get_network.return_value.network_id = MOCK_NETWORK_ID
        mock_wallet.send_transaction.side_effect = Exception("Transaction failed")

        # Create provider and call sell_token
        provider = WowActionProvider()
        args = {
            "contract_address": MOCK_CONTRACT_ADDRESS,
            "amount_tokens_in_wei": MOCK_AMOUNT_TOKENS,
        }
        response = provider.sell_token(mock_wallet, args)

        expected_response = "Error selling Zora Wow ERC20 memecoin: Transaction failed"
        assert response == expected_response

        # Verify contract calls
        mock_contract.assert_called_once_with(
            address=MOCK_CONTRACT_ADDRESS,
            abi=WOW_ABI,
        ) 