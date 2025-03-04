"""Tests for the terminate_compute action."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.schemas import TerminateComputeSchema

from .conftest import MOCK_API_KEY, MOCK_INSTANCE_ID


def test_terminate_compute_schema_valid():
    """Test that TerminateComputeSchema is valid with required parameters."""
    schema = TerminateComputeSchema(instance_id=MOCK_INSTANCE_ID)
    assert isinstance(schema, TerminateComputeSchema)
    assert schema.instance_id == MOCK_INSTANCE_ID


def test_terminate_compute_schema_invalid():
    """Test that TerminateComputeSchema validation fails with missing parameters."""
    with pytest.raises(ValueError):
        TerminateComputeSchema()


def test_terminate_compute_success(hyperbolic_provider, mock_make_api_request):
    """Test successful terminate_compute with valid response."""
    # Mock API response
    mock_response = {
        "status": "success",
        "message": "Instance terminated successfully"
    }
    mock_make_api_request.return_value = mock_response

    # Call the action
    args = {"instance_id": MOCK_INSTANCE_ID}
    result = hyperbolic_provider.terminate_compute(args)

    # Verify the result
    assert "Instance terminated successfully" in result

    # Verify API call
    mock_make_api_request.assert_called_once_with(
        api_key=MOCK_API_KEY,
        endpoint="marketplace/instances/terminate",
        data={"id": MOCK_INSTANCE_ID}
    )


def test_terminate_compute_error(hyperbolic_provider, mock_make_api_request):
    """Test error handling in terminate_compute."""
    # Mock API error
    error_message = "Instance not found"
    mock_make_api_request.side_effect = Exception(error_message)

    # Call the action
    args = {"instance_id": MOCK_INSTANCE_ID}
    result = hyperbolic_provider.terminate_compute(args)

    # Verify the result
    assert result == f"Error terminating compute: {error_message}" 