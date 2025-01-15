import json
from unittest.mock import AsyncMock, patch

import pytest
from allora_sdk.v2.api_client import AlloraTopic

from cdp_agentkit_core.actions.allora.get_all_topics import get_all_topics

MOCK_TOPICS = [
    AlloraTopic(
        topic_id=1,
        topic_name="Bitcoin 8h",
        description="Bitcoin price prediction for the next 8 hours",
        epoch_length=100,
        ground_truth_lag=10,
        loss_method="mean_squared_error",
        worker_submission_window=10,
        worker_count=10,
        reputer_count=10,
        total_staked_allo=1000,
        total_emissions_allo=1000,
        is_active=True,
        updated_at="2024-01-01",
    ),
    AlloraTopic(
        topic_id=2,
        topic_name="Ethereum 8h",
        description="Ethereum price prediction for the next 8 hours",
        epoch_length=100,
        ground_truth_lag=10,
        loss_method="mean_squared_error",
        worker_submission_window=10,
        worker_count=10,
        reputer_count=10,
        total_staked_allo=1000,
        total_emissions_allo=1000,
        is_active=True,
        updated_at="2024-01-01",
    ),
]


@pytest.mark.asyncio
async def test_get_all_topics_success():
    """Test successful retrieval of all topics."""
    with patch("cdp_agentkit_core.actions.allora.get_all_topics.AlloraAPIClient") as mock_client:
        mock_client_instance = mock_client.return_value
        # Convert AlloraTopic instances to dictionaries
        mock_topics_dict = [
            {
                "topic_id": topic.topic_id,
                "topic_name": topic.topic_name,
                "description": topic.description,
                "epoch_length": topic.epoch_length,
                "ground_truth_lag": topic.ground_truth_lag,
                "loss_method": topic.loss_method,
                "worker_submission_window": topic.worker_submission_window,
                "worker_count": topic.worker_count,
                "reputer_count": topic.reputer_count,
                "total_staked_allo": topic.total_staked_allo,
                "total_emissions_allo": topic.total_emissions_allo,
                "is_active": topic.is_active,
                "updated_at": topic.updated_at,
            }
            for topic in MOCK_TOPICS
        ]
        mock_client_instance.get_all_topics = AsyncMock(return_value=mock_topics_dict)

        result = await get_all_topics(mock_client_instance)

        expected_response = (
            f"The available topics at Allora Network are:\n{json.dumps(mock_topics_dict, indent=4)}"
        )
        assert result == expected_response

        mock_client_instance.get_all_topics.assert_called_once()


@pytest.mark.asyncio
async def test_get_all_topics_api_error():
    """Test topics retrieval when API error occurs."""
    with patch("cdp_agentkit_core.actions.allora.get_all_topics.AlloraAPIClient") as mock_client:
        mock_client_instance = mock_client.return_value
        mock_client_instance.get_all_topics.side_effect = Exception("API error")

        result = await get_all_topics(mock_client_instance)

        expected_response = "Error getting all topics: API error"
        assert result == expected_response

        mock_client_instance.get_all_topics.assert_called_once()
