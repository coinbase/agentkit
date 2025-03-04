"""Tests for the get_available_gpus action."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.schemas import GetAvailableGpusSchema

from .conftest import MOCK_API_KEY


def test_get_available_gpus_schema_valid():
    """Test that GetAvailableGpusSchema is valid with no parameters."""
    schema = GetAvailableGpusSchema()
    assert isinstance(schema, GetAvailableGpusSchema)


def test_get_available_gpus_success(hyperbolic_provider, mock_make_api_request):
    """Test successful get_available_gpus with valid response."""
    # Mock API response with GPU instances
    mock_instances = [
        {
            "id": "node-123",
            "cluster_name": "us-east-1",
            "reserved": False,
            "hardware": {
                "gpus": [
                    {"model": "NVIDIA A100"}
                ]
            },
            "pricing": {
                "price": {
                    "amount": 250  # $2.50 in cents
                }
            },
            "gpus_total": 8,
            "gpus_reserved": 4
        }
    ]
    mock_make_api_request.return_value = {"instances": mock_instances}

    # Call the action
    result = hyperbolic_provider.get_available_gpus({})

    # Verify the result
    assert "Available GPU Options:" in result
    assert "Cluster: us-east-1" in result
    assert "Node ID: node-123" in result
    assert "GPU Model: NVIDIA A100" in result
    assert "Available GPUs: 4/8" in result
    assert "Price: $2.50/hour per GPU" in result

    # Verify API call
    mock_make_api_request.assert_called_once_with(
        api_key=MOCK_API_KEY,
        endpoint="marketplace",
        data={"filters": {}}
    )


def test_get_available_gpus_empty_response(hyperbolic_provider, mock_make_api_request):
    """Test get_available_gpus with empty response."""
    # Mock empty API response
    mock_make_api_request.return_value = {"instances": []}

    # Call the action
    result = hyperbolic_provider.get_available_gpus({})

    # Verify the result
    assert result == "No available GPU instances found."


def test_get_available_gpus_error(hyperbolic_provider, mock_make_api_request):
    """Test error handling in get_available_gpus."""
    # Mock API error
    error_message = "API request failed"
    mock_make_api_request.side_effect = Exception(error_message)

    # Call the action
    result = hyperbolic_provider.get_available_gpus({})

    # Verify the result
    assert result == f"Error retrieving available GPUs: {error_message}" 