from unittest.mock import patch

import pytest
import requests

from cdp_agentkit_core.actions.pyth.fetch_price_feed_id import (
    PythFetchPriceFeedIDInput,
    pyth_fetch_price_feed_id,
)

MOCK_TOKEN_SYMBOL = "BTC"


def test_pyth_fetch_price_feed_id_input_model_valid():
    """Test that PythFetchPriceFeedIDInput accepts valid parameters."""
    input_model = PythFetchPriceFeedIDInput(
        token_symbol=MOCK_TOKEN_SYMBOL,
    )

    assert input_model.token_symbol == MOCK_TOKEN_SYMBOL


def test_pyth_fetch_price_feed_id_input_model_missing_params():
    """Test that PythFetchPriceFeedIDInput raises error when params are missing."""
    with pytest.raises(ValueError):
        PythFetchPriceFeedIDInput()


def test_pyth_fetch_price_feed_id_success():
    """Test successful pyth fetch price feed id with valid parameters."""
    mock_response = {
        "data": [
            {
                "id": "0ff1e87c65eb6e6f7768e66543859b7f3076ba8a3529636f6b2664f367c3344a",
                "type": "price_feed",
                "attributes": {"base": "BTC", "quote": "USD", "asset_type": "crypto"},
            }
        ]
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = mock_response["data"]
        mock_get.return_value.raise_for_status.return_value = None

        result = pyth_fetch_price_feed_id(MOCK_TOKEN_SYMBOL)

        assert result == "0ff1e87c65eb6e6f7768e66543859b7f3076ba8a3529636f6b2664f367c3344a"
        mock_get.assert_called_once_with(
            "https://hermes.pyth.network/v2/price_feeds?query=BTC&asset_type=crypto"
        )


def test_pyth_fetch_price_feed_id_empty_response():
    """Test pyth fetch price feed id error with empty response for ticker symbol."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = []
        mock_get.return_value.raise_for_status.return_value = None

        with pytest.raises(ValueError, match="No price feed found for TEST"):
            pyth_fetch_price_feed_id("TEST")


def test_pyth_fetch_price_feed_id_http_error():
    """Test pyth fetch price feed id error with HTTP error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.raise_for_status.side_effect = requests.exceptions.HTTPError(
            "404 Client Error: Not Found"
        )

        with pytest.raises(requests.exceptions.HTTPError):
            pyth_fetch_price_feed_id(MOCK_TOKEN_SYMBOL)
