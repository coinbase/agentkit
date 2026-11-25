from decimal import Decimal
from unittest.mock import patch

from coinbase_agentkit.network import Network


def test_swap_token_for_pt_success(
    pendle_wallet,
    pendle_provider,
    pendle_fixtures,
    pendle_market_response,
    pendle_convert_response,
):
    """swap_exact_token_for_pt approves the router and submits the route's tx."""
    with (
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.pendle_get_market"
        ) as mock_get_market,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.pendle_convert"
        ) as mock_convert,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_decimals"
        ) as mock_get_decimals,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.format_amount_with_decimals"
        ) as mock_format_atomic,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_balance"
        ) as mock_get_balance,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.approve_token"
        ) as mock_approve,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_symbol"
        ) as mock_get_symbol,
    ):
        mock_get_market.return_value = pendle_market_response
        mock_convert.return_value = pendle_convert_response
        mock_get_decimals.return_value = 6
        atomic = int(Decimal("100") * Decimal(10**6))
        mock_format_atomic.return_value = atomic
        mock_get_balance.return_value = atomic * 2
        mock_approve.return_value = "0xapprove_tx"
        mock_get_symbol.return_value = "USDC"

        pendle_wallet.send_transaction.return_value = "0xswap_tx"

        result = pendle_provider.swap_exact_token_for_pt(
            pendle_wallet,
            {
                "market_address": pendle_fixtures["market_address"],
                "token_in_address": pendle_fixtures["token_in"],
                "amount": "100",
                "slippage": 0.005,
            },
        )

        assert "Successfully swapped 100 USDC for PT" in result
        assert "PT-USDe-25APR" in result
        assert "0xswap_tx" in result

        mock_approve.assert_called_once()
        approve_args = mock_approve.call_args[0]
        assert approve_args[1] == pendle_fixtures["token_in"]
        assert approve_args[2] == pendle_fixtures["router_address"]
        assert approve_args[3] == 100_000_000

        pendle_wallet.send_transaction.assert_called_once()
        tx_params = pendle_wallet.send_transaction.call_args[0][0]
        assert tx_params["data"] == pendle_convert_response["routes"][0]["tx"]["data"]


def test_swap_token_for_pt_unsupported_network(pendle_wallet, pendle_provider, pendle_fixtures):
    """Returns an error when the wallet is on an unsupported network."""
    pendle_wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id="optimism-mainnet",
        chain_id="10",
    )

    result = pendle_provider.swap_exact_token_for_pt(
        pendle_wallet,
        {
            "market_address": pendle_fixtures["market_address"],
            "token_in_address": pendle_fixtures["token_in"],
            "amount": "100",
        },
    )

    assert "optimism-mainnet is not supported" in result


def test_swap_token_for_pt_insufficient_balance(
    pendle_wallet,
    pendle_provider,
    pendle_fixtures,
    pendle_market_response,
):
    """Returns an error when the wallet balance is too low."""
    with (
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.pendle_get_market"
        ) as mock_get_market,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_decimals"
        ) as mock_get_decimals,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.format_amount_with_decimals"
        ) as mock_format_atomic,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_balance"
        ) as mock_get_balance,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.format_amount_from_decimals"
        ) as mock_format_human,
    ):
        mock_get_market.return_value = pendle_market_response
        mock_get_decimals.return_value = 6
        mock_format_atomic.return_value = 100_000_000
        mock_get_balance.return_value = 1_000_000
        mock_format_human.return_value = "1"

        result = pendle_provider.swap_exact_token_for_pt(
            pendle_wallet,
            {
                "market_address": pendle_fixtures["market_address"],
                "token_in_address": pendle_fixtures["token_in"],
                "amount": "100",
            },
        )

        assert "Insufficient balance" in result
        pendle_wallet.send_transaction.assert_not_called()


def test_swap_pt_for_token_success(
    pendle_wallet,
    pendle_provider,
    pendle_fixtures,
    pendle_market_response,
    pendle_convert_response,
):
    """swap_exact_pt_for_token sells PT and reports the underlying received."""
    with (
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.pendle_get_market"
        ) as mock_get_market,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.pendle_convert"
        ) as mock_convert,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_decimals"
        ) as mock_get_decimals,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.format_amount_with_decimals"
        ) as mock_format_atomic,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_balance"
        ) as mock_get_balance,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.approve_token"
        ) as mock_approve,
        patch(
            "coinbase_agentkit.action_providers.pendle.pendle_action_provider.get_token_symbol"
        ) as mock_get_symbol,
    ):
        mock_get_market.return_value = pendle_market_response
        mock_convert.return_value = pendle_convert_response
        mock_get_decimals.return_value = 18
        atomic = int(Decimal("50") * Decimal(10**18))
        mock_format_atomic.return_value = atomic
        mock_get_balance.return_value = atomic * 2
        mock_approve.return_value = "0xapprove_pt"
        mock_get_symbol.return_value = "USDC"

        pendle_wallet.send_transaction.return_value = "0xsell_tx"

        result = pendle_provider.swap_exact_pt_for_token(
            pendle_wallet,
            {
                "market_address": pendle_fixtures["market_address"],
                "token_out_address": pendle_fixtures["underlying_address"],
                "pt_amount": "50",
            },
        )

        assert "Successfully sold 50 PT for USDC" in result
        assert "0xsell_tx" in result


def test_get_pendle_market_info_success(
    pendle_wallet, pendle_provider, pendle_fixtures, pendle_market_response
):
    """get_pendle_market_info returns a markdown summary of the market."""
    with patch(
        "coinbase_agentkit.action_providers.pendle.pendle_action_provider.pendle_get_market"
    ) as mock_get_market:
        mock_get_market.return_value = pendle_market_response

        result = pendle_provider.get_pendle_market_info(
            pendle_wallet,
            {"market_address": pendle_fixtures["market_address"]},
        )

        assert "PT-USDe-25APR" in result
        assert pendle_fixtures["pt_address"] in result
        assert pendle_fixtures["yt_address"] in result
        assert pendle_fixtures["sy_address"] in result
        assert pendle_fixtures["underlying_address"] in result
