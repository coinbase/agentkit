"""Tests for the rent_compute action."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.schemas import RentComputeSchema

from .conftest import (
    MOCK_API_KEY,
    MOCK_CLUSTER_NAME,
    MOCK_NODE_NAME,
    MOCK_GPU_COUNT,
    MOCK_INSTANCE_ID,
)


def test_rent_compute_schema_valid():
    """Test that RentComputeSchema is valid with required parameters."""
    schema = RentComputeSchema(
        cluster_name=MOCK_CLUSTER_NAME,
        node_name=MOCK_NODE_NAME,
        gpu_count=MOCK_GPU_COUNT,
    )
    assert isinstance(schema, RentComputeSchema)
    assert schema.cluster_name == MOCK_CLUSTER_NAME
    assert schema.node_name == MOCK_NODE_NAME
    assert schema.gpu_count == MOCK_GPU_COUNT


def test_rent_compute_schema_invalid():
    """Test that RentComputeSchema validation fails with missing parameters."""
    with pytest.raises(ValueError):
        RentComputeSchema()


def test_rent_compute_success(hyperbolic_provider, mock_make_api_request):
    """Test successful rent_compute with valid response."""
    # Mock API response
    mock_response = {
        "status": "success",
        "instance": {
            "id": MOCK_INSTANCE_ID,
            "cluster": MOCK_CLUSTER_NAME,
            "node": MOCK_NODE_NAME,
            "gpu_count": MOCK_GPU_COUNT,
            "status": "starting",
        }
    }
    mock_make_api_request.return_value = mock_response

    # Call the action
    args = {
        "cluster_name": MOCK_CLUSTER_NAME,
        "node_name": MOCK_NODE_NAME,
        "gpu_count": MOCK_GPU_COUNT,
    }
    result = hyperbolic_provider.rent_compute(args)

    # Verify the result contains the JSON response and next steps
    assert "status" in result
    assert "success" in result
    assert MOCK_INSTANCE_ID in result
    assert "Next Steps:" in result
    assert "Your GPU instance is being provisioned" in result
    assert "Use get_gpu_status to check when it's ready" in result

    # Verify API call
    mock_make_api_request.assert_called_once_with(
        api_key=MOCK_API_KEY,
        endpoint="marketplace/instances/create",
        data={
            "cluster_name": MOCK_CLUSTER_NAME,
            "node_name": MOCK_NODE_NAME,
            "gpu_count": MOCK_GPU_COUNT,
        }
    )


def test_rent_compute_error(hyperbolic_provider, mock_make_api_request):
    """Test error handling in rent_compute."""
    # Mock API error
    error_message = "Node not available"
    mock_make_api_request.side_effect = Exception(error_message)

    # Call the action
    args = {
        "cluster_name": MOCK_CLUSTER_NAME,
        "node_name": MOCK_NODE_NAME,
        "gpu_count": MOCK_GPU_COUNT,
    }
    result = hyperbolic_provider.rent_compute(args)

    # Verify the result
    assert result == f"Error renting compute: {error_message}" 