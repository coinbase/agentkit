"""Tests for get_available_gpus action in HyperbolicActionProvider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
)


@pytest.fixture
def mock_api_response():
    """Mock API response for available GPUs."""
    return {
        "instances": [
            {
                "id": "korea-amd14-78",
                "status": "node_ready",
                "hardware": {
                    "cpus": [{"hardware_type": "cpu", "model": "AMD-23-49", "virtual_cores": 32}],
                    "gpus": [
                        {
                            "hardware_type": "gpu",
                            "model": "NVIDIA-GeForce-RTX-3070",
                            "clock_speed": 1000,
                            "compute_power": 1000,
                            "ram": 8192,
                            "interface": "PCIeX16",
                        }
                    ],
                    "storage": [{"hardware_type": "storage", "capacity": 80}],
                    "ram": [{"hardware_type": "ram", "capacity": 1070}],
                },
                "location": {"region": "region-1"},
                "gpus_total": 1,
                "gpus_reserved": 0,
                "has_persistent_storage": True,
                "pricing": {
                    "price": {
                        "amount": 2000,  # 20.00 USD
                        "period": "hourly",
                        "agent": "platform",
                    }
                },
                "reserved": False,
                "cluster_name": "angelic-mushroom-dolphin",
            },
            {
                "id": "korea-amd11-181",
                "status": "node_ready",
                "hardware": {
                    "cpus": [{"hardware_type": "cpu", "model": "AMD-23-49", "virtual_cores": 32}],
                    "gpus": [
                        {
                            "hardware_type": "gpu",
                            "model": "NVIDIA-GeForce-RTX-3070",
                            "clock_speed": 1000,
                            "compute_power": 1000,
                            "ram": 8192,
                            "interface": "PCIeX16",
                        }
                    ],
                    "storage": [{"hardware_type": "storage", "capacity": 80}],
                    "ram": [{"hardware_type": "ram", "capacity": 1070}],
                },
                "location": {"region": "region-1"},
                "gpus_total": 1,
                "gpus_reserved": 0,
                "has_persistent_storage": True,
                "pricing": {
                    "price": {
                        "amount": 1600,  # 16.00 USD
                        "period": "hourly",
                        "agent": "platform",
                    }
                },
                "reserved": False,
                "cluster_name": "beneficial-palm-boar",
            },
        ]
    }


@pytest.fixture
def provider():
    """Create HyperbolicActionProvider instance with test API key."""
    return HyperbolicActionProvider(api_key="test-api-key")


def test_get_available_gpus_success(provider, mock_api_response):
    """Test successful get_available_gpus action."""
    mock_response = Mock()
    mock_response.json.return_value = mock_api_response

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_response) as mock_post,
    ):
        result = provider.get_available_gpus({})

        # Verify the API call
        mock_post.assert_called_once_with(
            "https://api.hyperbolic.xyz/v1/marketplace",
            headers={"Content-Type": "application/json", "Authorization": "Bearer test-api-key"},
            json={"filters": {}},
        )

        # Check header
        assert "Available GPU Options:" in result

        # Check first instance
        assert "Cluster: angelic-mushroom-dolphin" in result
        assert "Node ID: korea-amd14-78" in result
        assert "GPU Model: NVIDIA-GeForce-RTX-3070" in result
        assert "Available GPUs: 1/1" in result
        assert "Price: $20.00/hour per GPU" in result

        # Check second instance
        assert "Cluster: beneficial-palm-boar" in result
        assert "Node ID: korea-amd11-181" in result
        assert "GPU Model: NVIDIA-GeForce-RTX-3070" in result
        assert "Available GPUs: 1/1" in result
        assert "Price: $16.00/hour per GPU" in result

        # Verify order of appearance
        first_idx = result.find("angelic-mushroom-dolphin")
        second_idx = result.find("beneficial-palm-boar")
        assert first_idx < second_idx, "GPU instances should be listed in order"


def test_get_available_gpus_empty_response(provider):
    """Test get_available_gpus action with empty response."""
    mock_response = Mock()
    mock_response.json.return_value = {"instances": []}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_response) as mock_post,
    ):
        result = provider.get_available_gpus({})
        mock_post.assert_called_once_with(
            "https://api.hyperbolic.xyz/v1/marketplace",
            headers={"Content-Type": "application/json", "Authorization": "Bearer test-api-key"},
            json={"filters": {}},
        )
        assert "No available GPU instances found." in result


def test_get_available_gpus_api_error(provider):
    """Test get_available_gpus action with API error."""
    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", side_effect=Exception("API Error")) as mock_post,
    ):
        result = provider.get_available_gpus({})
        mock_post.assert_called_once_with(
            "https://api.hyperbolic.xyz/v1/marketplace",
            headers={"Content-Type": "application/json", "Authorization": "Bearer test-api-key"},
            json={"filters": {}},
        )
        assert "Error retrieving available GPUs: API Error" in result


def test_get_available_gpus_invalid_response(provider):
    """Test get_available_gpus action with invalid response format."""
    mock_response = Mock()
    mock_response.json.return_value = {"invalid": "response"}

    with (
        patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"),
        patch("requests.post", return_value=mock_response) as mock_post,
    ):
        result = provider.get_available_gpus({})
        mock_post.assert_called_once_with(
            "https://api.hyperbolic.xyz/v1/marketplace",
            headers={"Content-Type": "application/json", "Authorization": "Bearer test-api-key"},
            json={"filters": {}},
        )
        assert "No available GPU instances found." in result
