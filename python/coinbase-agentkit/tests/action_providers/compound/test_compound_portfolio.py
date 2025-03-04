from unittest.mock import patch


def test_get_portfolio_success(compound_wallet, compound_provider):
    """Test that the get_portfolio action returns the expected markdown details."""
    provider = compound_provider
    # No need to override _get_comet_address since compound_provider fixture sets it to "0xComet"

    # The input args are ignored by the implementation
    input_args = {"comet_address": "dummy", "account": "0xWallet"}

    with patch(
        "coinbase_agentkit.action_providers.compound.compound_action_provider.get_portfolio_details_markdown"
    ) as mock_get_portfolio_details:
        mock_get_portfolio_details.return_value = "Portfolio Details Markdown"

        result = provider.get_portfolio(compound_wallet, input_args)

        mock_get_portfolio_details.assert_called_once_with(compound_wallet, "0xComet")
        assert result == "Portfolio Details Markdown"


def test_get_portfolio_failure(compound_wallet, compound_provider):
    """Test that the get_portfolio action returns an error message if portfolio details fail."""
    provider = compound_provider

    input_args = {}

    with patch(
        "coinbase_agentkit.action_providers.compound.compound_action_provider.get_portfolio_details_markdown",
        side_effect=Exception("Test error"),
    ):
        result = provider.get_portfolio(compound_wallet, input_args)

        assert "Error getting portfolio details:" in result
        assert "Test error" in result
