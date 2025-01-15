from unittest.mock import AsyncMock, Mock, patch

import pytest

from cdp_agentkit_core.actions.allora.get_price_inference import (
    GetPriceInferenceInput,
    get_price_inference,
)

MOCK_TOKEN = "BTC"
MOCK_TIMEFRAME = "5m"


def test_get_price_inference_input_model_valid():
    """Test that GetPriceInferenceInput accepts valid parameters."""
    input_model = GetPriceInferenceInput(
        token=MOCK_TOKEN,
        timeframe=MOCK_TIMEFRAME,
    )

    assert input_model.token == MOCK_TOKEN
    assert input_model.timeframe == MOCK_TIMEFRAME


def test_get_price_inference_input_model_missing_params():
    """Test that GetPriceInferenceInput raises error when params are missing."""
    with pytest.raises(ValueError):
        GetPriceInferenceInput()


@pytest.mark.asyncio
async def test_get_price_inference_success():
    """Test successful price inference with valid parameters."""
    mock_inference = Mock()
    mock_inference.inference_data.network_inference_normalized = "50000.00"

    with patch(
        "cdp_agentkit_core.actions.allora.get_price_inference.AlloraAPIClient"
    ) as mock_client:
        mock_client_instance = mock_client.return_value
        mock_client_instance.get_price_inference = AsyncMock(return_value=mock_inference)

        result = await get_price_inference(mock_client_instance, MOCK_TOKEN, MOCK_TIMEFRAME)

        expected_response = (
            f"The future price inference for {MOCK_TOKEN} in {MOCK_TIMEFRAME} is 50000.00"
        )
        assert result == expected_response

        mock_client_instance.get_price_inference.assert_called_once_with(MOCK_TOKEN, MOCK_TIMEFRAME)


@pytest.mark.asyncio
async def test_get_price_inference_api_error():
    """Test price inference when API error occurs."""
    with patch(
        "cdp_agentkit_core.actions.allora.get_price_inference.AlloraAPIClient"
    ) as mock_client:
        mock_client_instance = mock_client.return_value
        mock_client_instance.get_price_inference.side_effect = Exception("API error")

        result = await get_price_inference(mock_client_instance, MOCK_TOKEN, MOCK_TIMEFRAME)

        expected_response = "Error getting price inference: API error"
        assert result == expected_response

        mock_client_instance.get_price_inference.assert_called_once_with(MOCK_TOKEN, MOCK_TIMEFRAME)
