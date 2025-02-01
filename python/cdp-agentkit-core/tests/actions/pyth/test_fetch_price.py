from unittest.mock import patch

import pytest
import requests

from cdp_agentkit_core.actions.pyth.fetch_price import (
    PythFetchPriceInput,
    pyth_fetch_price,
)

MOCK_PRICE_FEED_ID = "valid-price-feed-id"


def test_pyth_fetch_price_input_model_valid():
    """Test that PythFetchPriceInput accepts valid parameters."""
    input_model = PythFetchPriceInput(
        price_feed_id=MOCK_PRICE_FEED_ID,
    )

    assert input_model.price_feed_id == MOCK_PRICE_FEED_ID


def test_pyth_fetch_price_input_model_missing_params():
    """Test that PythFetchPriceInput raises error when params are missing."""
    with pytest.raises(ValueError):
        PythFetchPriceInput()


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

        result = pyth_fetch_price(MOCK_PRICE_FEED_ID)

        assert result == "42123.45"


def test_pyth_fetch_price_http_error():
    """Test pyth fetch price error with HTTP error."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.raise_for_status.side_effect = requests.exceptions.HTTPError(
            "404 Client Error: Not Found"
        )

        with pytest.raises(requests.exceptions.HTTPError):
            pyth_fetch_price(MOCK_PRICE_FEED_ID)
