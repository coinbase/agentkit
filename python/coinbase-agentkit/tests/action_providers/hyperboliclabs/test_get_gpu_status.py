"""Tests for get_gpu_status action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)


@pytest.fixture
def mock_api_response():
    """Mock API response for GPU status."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "instances": [
            {
                "id": "i-123456",
                "instance": {
                    "status": "running",
                    "hardware": {"gpus": [{"model": "NVIDIA A100", "count": 2}]},
                },
                "sshCommand": "ssh user@host -i key.pem",
            },
            {
                "id": "i-789012",
                "instance": {
                    "status": "starting",
                    "hardware": {"gpus": [{"model": "NVIDIA A100", "count": 1}]},
                },
            },
        ]
    }
    return mock_response


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


def test_get_gpu_status_success(provider, mock_api_response):
    """Test successful get_gpu_status action."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_api_response),
    ):
        result = provider.get_gpu_status({})

        # Check first instance (running)
        assert "Your Rented GPU Instances:" in result
        assert "Instance ID: i-123456" in result
        assert "Status: running (Ready to use)" in result
        assert "GPU Model: NVIDIA A100" in result
        assert "ssh user@host -i key.pem" in result

        # Check second instance (starting)
        assert "Instance ID: i-789012" in result
        assert "Status: starting (Still initializing)" in result
        assert "Instance is starting up. Please check again in a few seconds." in result

        # Check SSH instructions
        assert "SSH Connection Instructions:" in result
        assert "1. Wait until instance status is 'running'" in result
        assert "2. Use the ssh_connect action" in result


def test_get_gpu_status_no_instances(provider):
    """Test get_gpu_status action with no instances."""
    mock_response = Mock()
    mock_response.json.return_value = {"instances": []}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.get_gpu_status({})
        assert "No rented GPU instances found." in result


def test_get_gpu_status_api_error(provider):
    """Test get_gpu_status action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", side_effect=Exception("API Error")),
    ):
        result = provider.get_gpu_status({})
        assert "Error retrieving GPU status: API Error" in result


def test_get_gpu_status_invalid_response(provider):
    """Test get_gpu_status action with invalid response format."""
    mock_response = Mock()
    mock_response.json.return_value = {"invalid": "response"}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.get_gpu_status({})
        assert "No rented GPU instances found." in result


def test_get_gpu_status_malformed_instance(provider):
    """Test get_gpu_status action with malformed instance data."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "instances": [
            {
                "id": "i-123456",
                # Missing instance data, should use defaults
            }
        ]
    }

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.get", return_value=mock_response),
    ):
        result = provider.get_gpu_status({})

        # Check that defaults are used
        assert "Instance ID: i-123456" in result
        assert "Status: Unknown (Instance is still being provisioned)" in result
        assert "GPU Model: Unknown Model" in result
        assert "GPU Count: 1" in result  # Default GPU count
        assert "Instance is still being provisioned" in result
        assert "Please check again in 30-60 seconds" in result
