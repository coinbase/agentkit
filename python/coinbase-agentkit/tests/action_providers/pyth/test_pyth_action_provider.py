from unittest.mock import patch

import pytest
import requests

from coinbase_agentkit.action_providers.pyth.pyth_action_provider import pyth_action_provider

MOCK_TOKEN_SYMBOL = "BTC"
MOCK_PRICE_FEED_ID = "0ff1e87c65eb6e6f7768e66543859b7f3076ba8a3529636f6b2664f367c3344a"


def test_pyth_fetch_price_feed_id_success():
    """Test successful pyth fetch price feed id with valid parameters."""
    mock_response = {
        "data": [
            {
                "id": MOCK_PRICE_FEED_ID,
                "type": "price_feed",
                "attributes": {"base": "BTC", "quote": "USD", "asset_type": "crypto"},
            }
        ]
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_response["data"]
        mock_get.return_value.raise_for_status.return_value = None

        result = pyth_action_provider().fetch_price_feed_id({"token_symbol": MOCK_TOKEN_SYMBOL})

        assert result == MOCK_PRICE_FEED_ID
        mock_get.assert_called_once_with(
            "https://hermes.pyth.network/v2/price_feeds?query=BTC&asset_type=crypto"
        )


def test_pyth_fetch_price_feed_id_empty_response():
    """Test pyth fetch price feed id error with empty response for ticker symbol."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = []
        mock_get.return_value.raise_for_status.return_value = None

        with pytest.raises(ValueError, match="No price feed found for TEST"):
            pyth_action_provider().fetch_price_feed_id({"token_symbol": "TEST"})


def test_pyth_fetch_price_feed_id_http_error():
    """Test pyth fetch price feed id error with HTTP error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.raise_for_status.side_effect = requests.exceptions.HTTPError(
            "404 Client Error: Not Found"
        )

        with pytest.raises(requests.exceptions.HTTPError):
            pyth_action_provider().fetch_price_feed_id({"token_symbol": MOCK_TOKEN_SYMBOL})


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
        mock_get.return_value.raise_for_status.return_value = None

        result = pyth_action_provider().fetch_price({"price_feed_id": MOCK_PRICE_FEED_ID})

        assert result == "42123.45"


def test_pyth_fetch_price_http_error():
    """Test pyth fetch price error with HTTP error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.raise_for_status.side_effect = requests.exceptions.HTTPError(
            "404 Client Error: Not Found"
        )

        result = pyth_action_provider().fetch_price({"price_feed_id": MOCK_PRICE_FEED_ID})
        assert "Error fetching price from Pyth" in result
