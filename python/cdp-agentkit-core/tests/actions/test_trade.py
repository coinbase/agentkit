from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.trade import (
    TradeInput,
    trade,
)

MOCK_NETWORK_ID = "base-mainnet"
MOCK_AMOUNT = "3000"
MOCK_TO_AMOUNT = "1"
MOCK_FROM_ASSET_ID = "usdc"
MOCK_TO_ASSET_ID = "weth"


def test_trade_input_model_valid():
    """Test that TradeInput accepts valid parameters."""
    input_model = TradeInput(
        amount=MOCK_AMOUNT,
        from_asset_id=MOCK_FROM_ASSET_ID,
        to_asset_id=MOCK_TO_ASSET_ID,
    )

    assert input_model.amount == MOCK_AMOUNT
    assert input_model.from_asset_id == MOCK_FROM_ASSET_ID
    assert input_model.to_asset_id == MOCK_TO_ASSET_ID


def test_trade_input_model_missing_params():
    """Test that TradeInput raises error when params are missing."""
    with pytest.raises(ValueError):
        TradeInput()


def test_trade_success(wallet_factory, trade_factory):
    """Test successful trade with valid parameters."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)
    mock_trade_instance = trade_factory(to_amount=MOCK_TO_AMOUNT)

    with (
        patch.object(mock_wallet, "trade", return_value=mock_trade_instance) as mock_trade,
        patch.object(
            mock_trade_instance, "wait", return_value=mock_trade_instance
        ) as mock_trade_wait,
    ):
        action_response = trade(mock_wallet, MOCK_AMOUNT, MOCK_FROM_ASSET_ID, MOCK_TO_ASSET_ID)

        expected_response = f"Traded {MOCK_AMOUNT} of {MOCK_FROM_ASSET_ID} for {MOCK_TO_AMOUNT} of {MOCK_TO_ASSET_ID}.\nTransaction hash for the trade: {mock_trade_instance.transaction.transaction_hash}\nTransaction link for the trade: {mock_trade_instance.transaction.transaction_link}"
        assert action_response == expected_response
        mock_trade.assert_called_once_with(
            amount=MOCK_AMOUNT,
            from_asset_id=MOCK_FROM_ASSET_ID,
            to_asset_id=MOCK_TO_ASSET_ID,
        )
        mock_trade_wait.assert_called_once_with()


def test_trade_api_error(wallet_factory):
    """Test trade when API error occurs."""
    mock_wallet = wallet_factory(network_id=MOCK_NETWORK_ID)

    with patch.object(mock_wallet, "trade", side_effect=Exception("API error")) as mock_trade:
        action_response = trade(mock_wallet, MOCK_AMOUNT, MOCK_FROM_ASSET_ID, MOCK_TO_ASSET_ID)

        expected_response = "Error trading assets API error"

        assert action_response == expected_response
        mock_trade.assert_called_once_with(
            amount=MOCK_AMOUNT,
            from_asset_id=MOCK_FROM_ASSET_ID,
            to_asset_id=MOCK_TO_ASSET_ID,
        )
