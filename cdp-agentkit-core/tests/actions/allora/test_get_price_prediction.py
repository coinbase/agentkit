from unittest.mock import AsyncMock, Mock, patch

import pytest

from cdp_agentkit_core.actions.allora.get_price_prediction import (
    GetPricePredictionInput,
    get_price_prediction,
)

MOCK_TOKEN = "BTC"
MOCK_TIMEFRAME = "5m"


def test_get_price_prediction_input_model_valid():
    """Test that GetPricePredictionInput accepts valid parameters."""
    input_model = GetPricePredictionInput(
        token=MOCK_TOKEN,
        timeframe=MOCK_TIMEFRAME,
    )

    assert input_model.token == MOCK_TOKEN
    assert input_model.timeframe == MOCK_TIMEFRAME


def test_get_price_prediction_input_model_missing_params():
    """Test that GetPricePredictionInput raises error when params are missing."""
    with pytest.raises(ValueError):
        GetPricePredictionInput()


@pytest.mark.asyncio
async def test_get_price_prediction_success():
    """Test successful price prediction with valid parameters."""
    mock_inference = Mock()
    mock_inference.inference_data.network_inference_normalized = "50000.00"

    with patch(
        "cdp_agentkit_core.actions.allora.get_price_prediction.AlloraAPIClient"
    ) as mock_client:
        mock_client_instance = mock_client.return_value
        mock_client_instance.get_price_prediction = AsyncMock(return_value=mock_inference)

        result = await get_price_prediction(mock_client_instance, MOCK_TOKEN, MOCK_TIMEFRAME)

        expected_response = (
            f"The future price prediction for {MOCK_TOKEN} in {MOCK_TIMEFRAME} is 50000.00"
        )
        assert result == expected_response

        mock_client_instance.get_price_prediction.assert_called_once_with(
            MOCK_TOKEN, MOCK_TIMEFRAME
        )


@pytest.mark.asyncio
async def test_get_price_prediction_api_error():
    """Test price prediction when API error occurs."""
    with patch(
        "cdp_agentkit_core.actions.allora.get_price_prediction.AlloraAPIClient"
    ) as mock_client:
        mock_client_instance = mock_client.return_value
        mock_client_instance.get_price_prediction.side_effect = Exception("API error")

        result = await get_price_prediction(mock_client_instance, MOCK_TOKEN, MOCK_TIMEFRAME)

        expected_response = "Error getting price prediction: API error"
        assert result == expected_response

        mock_client_instance.get_price_prediction.assert_called_once_with(
            MOCK_TOKEN, MOCK_TIMEFRAME
        )
