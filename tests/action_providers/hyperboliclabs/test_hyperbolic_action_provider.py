import pytest
from unittest.mock import patch

# Mock constants for testing
MOCK_API_KEY = "test_api_key"
MOCK_CLUSTER_NAME = "test_cluster"
MOCK_NODE_NAME = "test_node"

@pytest.fixture
def mock_make_api_request():
    """Create a mock for the make_api_request function."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.make_api_request") as mock:
        mock.return_value = {
            "instances": [
                {
                    "cluster_name": MOCK_CLUSTER_NAME,
                    "node_name": MOCK_NODE_NAME,
                    "gpu_count": 4,
                    "price": {"amount": 250},  # $2.50/hour
                    "hardware": {
                        "gpus": [{"model": "NVIDIA A100"}]
                    }
                }
            ]
        }
        yield mock

@pytest.fixture
def setup_environment():
    """Set up environment variables for testing."""
    with patch.dict("os.environ", {"HYPERBOLIC_API_KEY": MOCK_API_KEY}):
        yield

def test_get_available_gpus_success(mock_make_api_request, setup_environment):
    """Test successful retrieval of available GPUs."""
    from coinbase_agentkit.action_providers.hyperboliclabs import hyperbolic_action_provider
    
    provider = hyperbolic_action_provider()
    result = provider.get_available_gpus({})
    
    assert MOCK_CLUSTER_NAME in result
    assert MOCK_NODE_NAME in result
    assert "NVIDIA A100" in result
    assert "4" in result
    assert "$2.50/hour" in result
    
    mock_make_api_request.assert_called_once_with(
        api_key=MOCK_API_KEY,
        endpoint="marketplace",
        data={"filters": {}}
    ) 