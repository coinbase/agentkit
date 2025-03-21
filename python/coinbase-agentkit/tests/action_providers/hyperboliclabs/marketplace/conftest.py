"""Test fixtures for Hyperbolic marketplace service."""

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.action_provider import (
    MarketplaceActionProvider,
)
from coinbase_agentkit.action_providers.hyperboliclabs.marketplace.service import MarketplaceService

TEST_CLUSTER = "test-cluster"
TEST_NODE = "test-node"
TEST_GPU_COUNT = 2
TEST_INSTANCE_ID = "test-instance-id"


@pytest.fixture
def marketplace(api_key: str):
    """Create a Marketplace service instance for testing.

    Args:
        api_key: API key for authentication.

    Returns:
        Marketplace: A marketplace service instance initialized with the API key.

    """
    return MarketplaceService(api_key)


@pytest.fixture
def provider(mock_api_key):
    """Create a HyperbolicMarketplaceActionProvider with a mock API key.

    Args:
        mock_api_key: Mock API key for authentication.

    Returns:
        HyperbolicMarketplaceActionProvider: Provider with mock API key.

    """
    return MarketplaceActionProvider(api_key=mock_api_key)
