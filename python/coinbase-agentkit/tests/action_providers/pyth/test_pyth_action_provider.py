import json
from unittest.mock import patch

from coinbase_agentkit.action_providers.pyth.pyth_action_provider import pyth_action_provider

MOCK_TOKEN_SYMBOL = "BTC"
MOCK_PRICE_FEED_ID = "0ff1e87c65eb6e6f7768e66543859b7f3076ba8a3529636f6b2664f367c3344a"


def test_pyth_fetch_price_feed_success():
    """Test successful pyth fetch price feed with valid parameters."""
    mock_response = [
        {
            "id": MOCK_PRICE_FEED_ID,
            "type": "price_feed",
            "attributes": {
                "base": "BTC",
                "quote_currency": "USD",
                "asset_type": "crypto",
                "display_symbol": "BTC/USD",
            },
        }
    ]

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_response
        mock_get.return_value.ok = True

        result = pyth_action_provider().fetch_price_feed(
            {"token_symbol": MOCK_TOKEN_SYMBOL, "quote_currency": "USD", "asset_type": "crypto"}
        )

        parsed_result = json.loads(result)
        assert parsed_result["success"] is True
        assert parsed_result["priceFeedID"] == MOCK_PRICE_FEED_ID
        assert parsed_result["tokenSymbol"] == MOCK_TOKEN_SYMBOL
        assert parsed_result["quoteCurrency"] == "USD"
        assert parsed_result["feedType"] == "BTC/USD"
        mock_get.assert_called_once_with(
            "https://hermes.pyth.network/v2/price_feeds?query=BTC&asset_type=crypto"
        )


def test_pyth_fetch_price_feed_empty_response():
    """Test pyth fetch price feed error with empty response for ticker symbol."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = []
        mock_get.return_value.ok = True

        result = pyth_action_provider().fetch_price_feed(
            {"token_symbol": "TEST", "quote_currency": "USD", "asset_type": "crypto"}
        )

        parsed_result = json.loads(result)
        assert parsed_result["success"] is False
        assert "No price feed found for TEST" in parsed_result["error"]


def test_pyth_fetch_price_feed_http_error():
    """Test pyth fetch price feed error with HTTP error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = False
        mock_get.return_value.status = 404

        result = pyth_action_provider().fetch_price_feed(
            {"token_symbol": MOCK_TOKEN_SYMBOL, "quote_currency": "USD", "asset_type": "crypto"}
        )

        parsed_result = json.loads(result)
        assert parsed_result["success"] is False
        assert "HTTP error! status: 404" in parsed_result["error"]


def test_pyth_fetch_price_success():
    """Test successful pyth fetch price with valid parameters."""
    mock_response = {
        "parsed": [
            {
                "price": {
                    "price": "4212345",
                    "expo": -2,
                    "conf": "1234",
                },
                "id": "test_feed_id",
            }
        ]
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_response
        mock_get.return_value.ok = True

        result = pyth_action_provider().fetch_price({"price_feed_id": MOCK_PRICE_FEED_ID})

        parsed_result = json.loads(result)
        assert parsed_result["success"] is True
        assert parsed_result["priceFeedID"] == MOCK_PRICE_FEED_ID
        assert parsed_result["price"] == "42123.45"


def test_pyth_fetch_price_http_error():
    """Test pyth fetch price error with HTTP error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = False
        mock_get.return_value.status = 404

        result = pyth_action_provider().fetch_price({"price_feed_id": MOCK_PRICE_FEED_ID})

        parsed_result = json.loads(result)
        assert parsed_result["success"] is False
        assert "HTTP error! status: 404" in parsed_result["error"]


def test_pyth_fetch_price_equity_preference():
    """Test that equity feeds prefer regular market hours over pre/post market."""
    mock_response = [
        {
            "id": "post-market-feed-id",
            "attributes": {
                "base": "COIN",
                "quote_currency": "USD",
                "symbol": "Equity.US.COIN/USD.POST",
                "display_symbol": "COIN/USD POST MARKET",
            },
        },
        {
            "id": "regular-market-feed-id",
            "attributes": {
                "base": "COIN",
                "quote_currency": "USD",
                "symbol": "Equity.US.COIN/USD",
                "display_symbol": "COIN/USD",
            },
        },
        {
            "id": "pre-market-feed-id",
            "attributes": {
                "base": "COIN",
                "quote_currency": "USD",
                "symbol": "Equity.US.COIN/USD.PRE",
                "display_symbol": "COIN/USD PRE MARKET",
            },
        },
    ]

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_response
        mock_get.return_value.ok = True

        result = pyth_action_provider().fetch_price_feed(
            {"token_symbol": "COIN", "quote_currency": "USD", "asset_type": "equity"}
        )

        parsed_result = json.loads(result)
        assert parsed_result["success"] is True
        assert parsed_result["priceFeedID"] == "regular-market-feed-id"
        assert parsed_result["feedType"] == "COIN/USD"
