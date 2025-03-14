"""Unit tests for Hyperbolic Marketplace service."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.constants import MARKETPLACE_BASE_URL
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.service import MarketplaceService
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.types import (
    AvailableInstancesResponse,
    InstanceHistoryResponse,
    RentedInstancesResponse,
    RentInstanceRequest,
    RentInstanceResponse,
    TerminateInstanceRequest,
    TerminateInstanceResponse,
)

from .conftest import (
    TEST_CLUSTER,
    TEST_GPU_COUNT,
    TEST_INSTANCE_ID,
    TEST_NODE,
)


def test_marketplace_init(mock_api_key):
    """Test Marketplace service initialization."""
    service = MarketplaceService(mock_api_key)
    assert service.base_url == MARKETPLACE_BASE_URL
    assert service.api_key == mock_api_key


def test_marketplace_get_available_instances(mock_request, mock_api_key):
    """Test get_available_instances method with empty response."""
    service = MarketplaceService(mock_api_key)
    mock_request.return_value.json.return_value = {"instances": []}

    response = service.get_available_instances()
    assert isinstance(response, AvailableInstancesResponse)
    assert response.instances == []

    mock_request.assert_called_once()
    assert mock_request.call_args is not None
    assert "Bearer" in mock_request.call_args.kwargs.get("headers", {}).get("Authorization", "")
    assert mock_request.call_args.kwargs.get("json") == {"filters": {}}


def test_marketplace_get_available_instances_with_data(mock_request, mock_api_key):
    """Test get_available_instances method with populated response."""
    service = MarketplaceService(mock_api_key)

    mock_request.return_value.json.return_value = {
        "instances": [
            {
                "id": "node-123",
                "status": "available",
                "hardware": {
                    "gpus": [{"model": "NVIDIA A100", "hardware_type": "gpu"}],
                },
                "pricing": {"price": {"amount": 2.5, "period": "hourly"}},
                "cluster_name": "us-east-1",
                "gpu_count": 8,
                "gpus_reserved": 4,
            }
        ]
    }

    response = service.get_available_instances()
    assert isinstance(response, AvailableInstancesResponse)
    assert len(response.instances) == 1
    assert response.instances[0].id == "node-123"
    assert response.instances[0].status == "available"
    assert response.instances[0].cluster_name == "us-east-1"
    assert response.instances[0].gpu_count == 8
    assert response.instances[0].gpus_reserved == 4
    assert response.instances[0].hardware.gpus[0].model == "NVIDIA A100"

    mock_request.assert_called_once()


def test_marketplace_get_instance_history(mock_request, mock_api_key):
    """Test get_instance_history method with empty response."""
    service = MarketplaceService(mock_api_key)
    mock_request.return_value.json.return_value = {"instance_history": []}

    response = service.get_instance_history()
    assert isinstance(response, InstanceHistoryResponse)
    assert response.instance_history == []

    mock_request.assert_called_once()
    assert mock_request.call_args is not None
    assert "Bearer" in mock_request.call_args.kwargs.get("headers", {}).get("Authorization", "")


def test_marketplace_get_instance_history_with_data(mock_request, mock_api_key):
    """Test get_instance_history method with populated response."""
    service = MarketplaceService(mock_api_key)

    mock_request.return_value.json.return_value = {
        "instance_history": [
            {
                "instance_name": "test-instance-1",
                "started_at": "2023-01-01T00:00:00Z",
                "terminated_at": "2023-01-02T00:00:00Z",
                "price": {"amount": 2.5, "period": "hourly"},
                "hardware": {
                    "gpus": [{"model": "NVIDIA A100", "hardware_type": "gpu"}],
                },
                "gpu_count": 2,
            }
        ]
    }

    response = service.get_instance_history()
    assert isinstance(response, InstanceHistoryResponse)
    assert len(response.instance_history) == 1
    assert response.instance_history[0].instance_name == "test-instance-1"
    assert response.instance_history[0].started_at == "2023-01-01T00:00:00Z"
    assert response.instance_history[0].terminated_at == "2023-01-02T00:00:00Z"
    assert response.instance_history[0].price.amount == 2.5
    assert response.instance_history[0].price.period == "hourly"
    assert response.instance_history[0].gpu_count == 2

    mock_request.assert_called_once()


def test_marketplace_get_rented_instances(mock_request, mock_api_key):
    """Test get_rented_instances method with empty response."""
    service = MarketplaceService(mock_api_key)
    mock_request.return_value.json.return_value = {"instances": []}

    response = service.get_rented_instances()
    assert isinstance(response, RentedInstancesResponse)
    assert response.instances == []

    mock_request.assert_called_once()
    assert mock_request.call_args is not None
    assert "Bearer" in mock_request.call_args.kwargs.get("headers", {}).get("Authorization", "")


def test_marketplace_get_rented_instances_with_data(mock_request, mock_api_key):
    """Test get_rented_instances method with populated response."""
    service = MarketplaceService(mock_api_key)

    mock_request.return_value.json.return_value = {
        "instances": [
            {
                "id": "i-12345",
                "start": "2023-01-01T00:00:00Z",
                "instance": {
                    "id": "node-123",
                    "status": "running",
                    "hardware": {
                        "gpus": [{"model": "NVIDIA A100", "hardware_type": "gpu"}],
                    },
                },
                "ssh_access": {
                    "host": "host.example.com",
                    "username": "user",
                },
            }
        ]
    }

    response = service.get_rented_instances()
    assert isinstance(response, RentedInstancesResponse)
    assert len(response.instances) == 1
    assert response.instances[0].id == "i-12345"
    assert response.instances[0].start == "2023-01-01T00:00:00Z"
    assert response.instances[0].instance.id == "node-123"
    assert response.instances[0].instance.status == "running"
    assert response.instances[0].ssh_access is not None
    assert response.instances[0].ssh_access.host == "host.example.com"
    assert response.instances[0].ssh_access.username == "user"

    mock_request.assert_called_once()


def test_marketplace_rent_instance_success(mock_request, mock_api_key):
    """Test rent_instance method with successful response."""
    service = MarketplaceService(mock_api_key)

    mock_request.return_value.json.return_value = {
        "status": "success",
        "instance_name": TEST_INSTANCE_ID,
    }

    request = RentInstanceRequest(
        cluster_name=TEST_CLUSTER,
        node_name=TEST_NODE,
        gpu_count=TEST_GPU_COUNT,
    )
    response = service.rent_instance(request)
    assert isinstance(response, RentInstanceResponse)
    assert response.status == "success"
    assert response.instance_name == TEST_INSTANCE_ID

    mock_request.assert_called_once()
    assert mock_request.call_args is not None
    assert "Bearer" in mock_request.call_args.kwargs.get("headers", {}).get("Authorization", "")

    json_data = mock_request.call_args.kwargs.get("json", {})
    assert json_data.get("cluster_name") == TEST_CLUSTER
    assert json_data.get("node_name") == TEST_NODE
    assert json_data.get("gpu_count") == TEST_GPU_COUNT
    assert "image" in json_data


def test_marketplace_rent_instance_with_message(mock_request, mock_api_key):
    """Test rent_instance method with additional message in response."""
    service = MarketplaceService(mock_api_key)

    mock_request.return_value.json.return_value = {
        "status": "success",
        "instance_name": "instance-abc123",
        "message": "Instance created successfully",
    }

    request = RentInstanceRequest(
        cluster_name="us-west-2",
        node_name="node-456",
        gpu_count=4,
    )
    response = service.rent_instance(request)
    assert isinstance(response, RentInstanceResponse)
    assert response.status == "success"
    assert response.instance_name == "instance-abc123"

    mock_request.assert_called_once()
    assert mock_request.call_args is not None

    json_data = mock_request.call_args.kwargs.get("json", {})
    assert json_data.get("cluster_name") == "us-west-2"
    assert json_data.get("node_name") == "node-456"
    assert json_data.get("gpu_count") == 4
    assert "image" in json_data


def test_marketplace_rent_instance_error(mock_request, mock_api_key):
    """Test rent_instance method with HTTP error response."""
    service = MarketplaceService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("400 Client Error: Bad Request")

    request = RentInstanceRequest(
        cluster_name="invalid",
        node_name="invalid",
        gpu_count=0,
    )
    with pytest.raises(requests.exceptions.HTTPError, match="400 Client Error"):
        service.rent_instance(request)


def test_marketplace_rent_instance_connection_error(mock_request, mock_api_key):
    """Test rent_instance method with connection error."""
    service = MarketplaceService(mock_api_key)
    mock_request.side_effect = requests.exceptions.ConnectionError("Connection refused")

    request = RentInstanceRequest(
        cluster_name=TEST_CLUSTER,
        node_name=TEST_NODE,
        gpu_count=TEST_GPU_COUNT,
    )
    with pytest.raises(requests.exceptions.ConnectionError, match="Connection refused"):
        service.rent_instance(request)


def test_marketplace_terminate_instance_success(mock_request, mock_api_key):
    """Test terminate_instance method with successful response."""
    service = MarketplaceService(mock_api_key)

    mock_request.return_value.json.return_value = {
        "status": "success",
        "message": "Instance terminated successfully",
    }

    request = TerminateInstanceRequest(id=TEST_INSTANCE_ID)
    response = service.terminate_instance(request)
    assert isinstance(response, TerminateInstanceResponse)
    assert response.status == "success"
    assert response.message == "Instance terminated successfully"

    mock_request.assert_called_once()
    assert mock_request.call_args is not None
    assert "Bearer" in mock_request.call_args.kwargs.get("headers", {}).get("Authorization", "")
    assert mock_request.call_args.kwargs.get("json") == {"id": TEST_INSTANCE_ID}


def test_marketplace_terminate_instance_with_custom_message(mock_request, mock_api_key):
    """Test terminate_instance method with custom success message."""
    service = MarketplaceService(mock_api_key)

    mock_request.return_value.json.return_value = {
        "status": "success",
        "message": "Instance i-abc123 has been terminated",
    }

    request = TerminateInstanceRequest(id="i-abc123")
    response = service.terminate_instance(request)
    assert isinstance(response, TerminateInstanceResponse)
    assert response.status == "success"
    assert response.message == "Instance i-abc123 has been terminated"

    mock_request.assert_called_once()
    assert mock_request.call_args is not None
    assert mock_request.call_args.kwargs.get("json") == {"id": "i-abc123"}


def test_marketplace_terminate_instance_not_found(mock_request, mock_api_key):
    """Test terminate_instance method with not found error."""
    service = MarketplaceService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("404 Client Error: Not Found")

    request = TerminateInstanceRequest(id="invalid-id")
    with pytest.raises(requests.exceptions.HTTPError, match="404 Client Error"):
        service.terminate_instance(request)


def test_marketplace_terminate_instance_bad_request(mock_request, mock_api_key):
    """Test terminate_instance method with bad request error."""
    service = MarketplaceService(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("400 Client Error: Bad Request")

    request = TerminateInstanceRequest(id="")
    with pytest.raises(requests.exceptions.HTTPError, match="400 Client Error"):
        service.terminate_instance(request)
