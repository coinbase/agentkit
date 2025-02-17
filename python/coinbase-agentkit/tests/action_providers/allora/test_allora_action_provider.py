"""Tests for Allora action provider."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from allora_sdk.v2.api_client import (
    AlloraAPIClient,
    ChainSlug,
    PriceInferenceToken,
    PriceInferenceTimeframe,
)

from coinbase_agentkit.action_providers.allora.allora_action_provider import AlloraActionProvider
from coinbase_agentkit.action_providers.allora.schemas import (
    GetAllTopicsInput,
    GetInferenceByTopicIdInput,
    GetPriceInferenceInput,
)


@pytest.fixture
def mock_client():
    """Create a mock Allora API client."""
    with patch("allora_sdk.v2.api_client.AlloraAPIClient") as mock:
        yield mock


@pytest.fixture
def provider(mock_client):
    """Create an Allora action provider with a mock client."""
    provider = AlloraActionProvider(api_key="test-api-key", chain_slug=ChainSlug.TESTNET)
    provider.client = mock_client.return_value
    return provider


def test_get_all_topics_input_schema():
    """Test get all topics input schema."""
    # Empty input is valid for this schema
    parsed_input = GetAllTopicsInput()
    assert isinstance(parsed_input, GetAllTopicsInput)


def test_get_inference_by_topic_id_input_schema():
    """Test get inference by topic ID input schema."""
    # Test valid inputs
    valid_inputs = [
        {"topic_id": 1},
        {"topic_id": 100},
        {"topic_id": 999999},
    ]
    for input_data in valid_inputs:
        parsed_input = GetInferenceByTopicIdInput(**input_data)
        assert parsed_input.topic_id == input_data["topic_id"]

    # Test invalid topic IDs
    invalid_topic_ids = [
        0,  # Zero is not allowed
        -1,  # Negative numbers not allowed
        "1",  # String not allowed
        1.5,  # Float not allowed
    ]
    for topic_id in invalid_topic_ids:
        with pytest.raises(ValueError) as exc_info:
            GetInferenceByTopicIdInput(topic_id=topic_id)
        error_msg = str(exc_info.value)
        if isinstance(topic_id, (int, float)) and topic_id <= 0:
            assert "greater than 0" in error_msg
        else:
            assert "must be an integer" in error_msg


def test_get_price_inference_input_schema():
    """Test get price inference input schema."""
    # Test valid inputs
    valid_inputs = [
        {"asset": "BTC", "timeframe": "5m"},
        {"asset": "ETH", "timeframe": "8h"},
        # Test that other values are also accepted
        {"asset": "SOL", "timeframe": "1h"},
        {"asset": "DOGE", "timeframe": "1d"},
    ]
    for input_data in valid_inputs:
        parsed_input = GetPriceInferenceInput(**input_data)
        assert parsed_input.asset == input_data["asset"]
        assert parsed_input.timeframe == input_data["timeframe"]

    # Test that empty strings are not allowed (Pydantic's built-in validation)
    with pytest.raises(ValueError):
        GetPriceInferenceInput(asset="", timeframe="5m")
    with pytest.raises(ValueError):
        GetPriceInferenceInput(asset="BTC", timeframe="")


@pytest.mark.asyncio
async def test_get_all_topics_success(provider, mock_client):
    """Test successful get all topics."""
    mock_topics = [
        {
            "topic_id": 1,
            "topic_name": "Bitcoin 8h",
            "description": "Bitcoin price prediction",
            "epoch_length": 100,
            "ground_truth_lag": 10,
            "loss_method": "method1",
            "worker_submission_window": 50,
            "worker_count": 5,
            "reputer_count": 3,
            "total_staked_allo": 1000,
            "total_emissions_allo": 500,
            "is_active": True,
            "updated_at": "2023-01-01T00:00:00Z",
        }
    ]

    mock_client.return_value.get_all_topics = AsyncMock(return_value=mock_topics)
    result = await provider.get_all_topics({})

    assert "The available topics at Allora Network are:" in result
    assert json.dumps(mock_topics) in result


@pytest.mark.asyncio
async def test_get_all_topics_error(provider, mock_client):
    """Test error handling in get all topics."""
    error_msg = "API Error"
    mock_client.return_value.get_all_topics = AsyncMock(side_effect=Exception(error_msg))

    result = await provider.get_all_topics({})
    assert "Error getting all topics:" in result
    assert error_msg in result


@pytest.mark.asyncio
async def test_get_inference_by_topic_id_success(provider, mock_client):
    """Test successful get inference by topic ID."""
    mock_topic_id = 1
    mock_inference = MagicMock()
    mock_inference.inference_data = {
        "network_inference": "0.5",
        "network_inference_normalized": "0.5",
        "confidence_interval_percentiles": ["0.1", "0.5", "0.9"],
        "confidence_interval_values": ["0.1", "0.5", "0.9"],
        "topic_id": "1",
        "timestamp": 1718198400,
    }

    mock_client.return_value.get_inference_by_topic_id = AsyncMock(return_value=mock_inference)
    result = await provider.get_inference_by_topic_id({"topic_id": mock_topic_id})

    assert f"The inference for topic {mock_topic_id} is:" in result
    assert json.dumps(mock_inference.inference_data) in result


@pytest.mark.asyncio
async def test_get_inference_by_topic_id_error(provider, mock_client):
    """Test error handling in get inference by topic ID."""
    mock_topic_id = 1
    error_msg = "API Error"
    mock_client.return_value.get_inference_by_topic_id = AsyncMock(side_effect=Exception(error_msg))

    result = await provider.get_inference_by_topic_id({"topic_id": mock_topic_id})
    assert f"Error getting inference for topic {mock_topic_id}:" in result
    assert error_msg in result


@pytest.mark.asyncio
async def test_get_price_inference_success(provider, mock_client):
    """Test successful get price inference."""
    mock_asset = PriceInferenceToken.BTC
    mock_timeframe = PriceInferenceTimeframe.EIGHT_HOURS
    mock_inference = MagicMock()
    mock_inference.inference_data = {
        "network_inference_normalized": "50000.00",
        "timestamp": 1718198400,
    }

    mock_client.return_value.get_price_inference = AsyncMock(return_value=mock_inference)
    result = await provider.get_price_inference(
        {
            "asset": mock_asset,
            "timeframe": mock_timeframe,
        }
    )

    expected_response = {
        "price": "50000.00",
        "timestamp": 1718198400,
        "asset": mock_asset.value,
        "timeframe": mock_timeframe.value,
    }

    assert f"The price inference for {mock_asset.value} ({mock_timeframe.value}) is:" in result
    assert json.dumps(expected_response) in result


@pytest.mark.asyncio
async def test_get_price_inference_error(provider, mock_client):
    """Test error handling in get price inference."""
    mock_asset = PriceInferenceToken.BTC
    mock_timeframe = PriceInferenceTimeframe.EIGHT_HOURS
    error_msg = "API Error"
    mock_client.return_value.get_price_inference = AsyncMock(side_effect=Exception(error_msg))

    result = await provider.get_price_inference(
        {
            "asset": mock_asset,
            "timeframe": mock_timeframe,
        }
    )
    assert f"Error getting price inference for {mock_asset.value} ({mock_timeframe.value}):" in result
    assert error_msg in result
