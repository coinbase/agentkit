"""Test fixtures for Hyperbolic action provider tests."""

from unittest.mock import Mock, patch
import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.hyperbolic_action_provider import (
    HyperbolicActionProvider,
    hyperbolic_action_provider,
)

# Mock constants for testing
MOCK_API_KEY = "test_api_key"
MOCK_CLUSTER_NAME = "us-east-1"
MOCK_NODE_NAME = "node-123"
MOCK_GPU_COUNT = "2"
MOCK_INSTANCE_ID = "respectful-rose-pelican"
MOCK_WALLET_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_SSH_HOST = "example.com"
MOCK_SSH_USERNAME = "user"


@pytest.fixture
def mock_api_response():
    """Create a mock API response."""
    return {"status": "success"}


@pytest.fixture
def hyperbolic_provider():
    """Create a HyperbolicActionProvider instance with a mock API key."""
    with patch.dict("os.environ", {"HYPERBOLIC_API_KEY": MOCK_API_KEY}):
        return hyperbolic_action_provider()


@pytest.fixture
def mock_make_api_request():
    """Create a mock for the make_api_request function."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.utils.make_api_request") as mock:
        yield mock 