from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.wow.buy_token import (
    WowBuyTokenInput,
    wow_buy_token,
)
from cdp_agentkit_core.actions.wow.constants import WOW_ABI

MOCK_CONTRACT_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
MOCK_AMOUNT_ETH = "100000000000000"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_TOKEN_QUOTE = 1000000


def test_buy_token_input_model_valid():
    """Test that WowBuyTokenInput accepts valid parameters."""
    input_model = WowBuyTokenInput(
        contract_address=MOCK_CONTRACT_ADDRESS,
        amount_eth_in_wei=MOCK_AMOUNT_ETH,
    )

    assert input_model.contract_address == MOCK_CONTRACT_ADDRESS
    assert input_model.amount_eth_in_wei == MOCK_AMOUNT_ETH


def test_buy_token_input_model_missing_params():
    """Test that WowBuyTokenInput raises error when params are missing."""
    with pytest.raises(ValueError):
        WowBuyTokenInput()


def test_buy_token_success(wallet_factory, contract_invocation_factory):
    """Test successful token purchase with valid parameters."""
    mock_wallet = wallet_factory()
    mock_contract_instance = contract_invocation_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID

    with (
        patch(
            "cdp_agentkit_core.actions.wow.buy_token.get_buy_quote", return_value=MOCK_TOKEN_QUOTE
        ),
        patch("cdp_agentkit_core.actions.wow.buy_token.get_has_graduated", return_value=False),
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_instance
        ) as mock_invoke,
        patch.object(
            mock_contract_instance, "wait", return_value=mock_contract_instance
        ) as mock_contract_wait,
    ):
        action_response = wow_buy_token(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            MOCK_AMOUNT_ETH,
        )

        expected_response = f"Purchased WoW ERC20 memecoin with transaction hash: {mock_contract_instance.transaction.transaction_hash}"
        assert action_response == expected_response

        # Calculate expected minimum tokens (99% of quote)
        expected_min_tokens = str(int((MOCK_TOKEN_QUOTE * 99) // 100))

        mock_invoke.assert_called_once_with(
            contract_address=MOCK_CONTRACT_ADDRESS,
            method="buy",
            abi=WOW_ABI,
            args={
                "recipient": MOCK_WALLET_ADDRESS,
                "refundRecipient": MOCK_WALLET_ADDRESS,
                "orderReferrer": "0x0000000000000000000000000000000000000000",
                "expectedMarketType": "0",
                "minOrderSize": expected_min_tokens,
                "sqrtPriceLimitX96": "0",
                "comment": "",
            },
            amount=MOCK_AMOUNT_ETH,
            asset_id="wei",
        )
        mock_contract_wait.assert_called_once_with()


def test_buy_token_graduated_pool(wallet_factory, contract_invocation_factory):
    """Test token purchase with graduated pool."""
    mock_wallet = wallet_factory()
    mock_contract_instance = contract_invocation_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID

    with (
        patch(
            "cdp_agentkit_core.actions.wow.buy_token.get_buy_quote", return_value=MOCK_TOKEN_QUOTE
        ),
        patch("cdp_agentkit_core.actions.wow.buy_token.get_has_graduated", return_value=True),
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_contract_instance
        ) as mock_invoke,
        patch.object(mock_contract_instance, "wait", return_value=mock_contract_instance),
    ):
        wow_buy_token(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            MOCK_AMOUNT_ETH,
        )

        # Verify expectedMarketType is "1" for graduated pool
        assert mock_invoke.call_args[1]["args"]["expectedMarketType"] == "1"


def test_buy_token_api_error(wallet_factory):
    """Test buy_token when API error occurs."""
    mock_wallet = wallet_factory()
    mock_wallet.default_address.address_id = MOCK_WALLET_ADDRESS
    mock_wallet.network_id = MOCK_NETWORK_ID

    with (
        patch(
            "cdp_agentkit_core.actions.wow.buy_token.get_buy_quote", return_value=MOCK_TOKEN_QUOTE
        ),
        patch("cdp_agentkit_core.actions.wow.buy_token.get_has_graduated", return_value=False),
        patch.object(
            mock_wallet, "invoke_contract", side_effect=Exception("API error")
        ) as mock_invoke,
    ):
        action_response = wow_buy_token(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            MOCK_AMOUNT_ETH,
        )

        expected_response = "Error buying Zora Wow ERC20 memecoin API error"

        assert action_response == expected_response
        mock_invoke.assert_called_once()
