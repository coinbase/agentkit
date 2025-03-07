"""Test fixtures for Hyperbolic services."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.services import (
    AIServices,
    Billing,
    Hyperbolic,
    Marketplace,
    Settings,
)

# Test constants
TEST_API_KEY = ""


@pytest.fixture
def api_key() -> str:
    """Get API key for testing."""
    return TEST_API_KEY


@pytest.fixture
def hyperbolic(api_key: str) -> Hyperbolic:
    """Create Hyperbolic service instance."""
    return Hyperbolic(api_key)


@pytest.fixture
def marketplace(hyperbolic: Hyperbolic) -> Marketplace:
    """Get Marketplace service."""
    return hyperbolic.marketplace


@pytest.fixture
def billing(hyperbolic: Hyperbolic) -> Billing:
    """Get Billing service."""
    return hyperbolic.billing


@pytest.fixture
def settings(hyperbolic: Hyperbolic) -> Settings:
    """Get Settings service."""
    return hyperbolic.settings


@pytest.fixture
def ai_services(hyperbolic: Hyperbolic) -> AIServices:
    """Get AI services."""
    return hyperbolic.ai


@pytest.fixture
def mock_request():
    """Mock requests for all tests."""
    with patch("requests.request") as mock:
        mock.return_value.json.return_value = {"status": "success"}
        mock.return_value.raise_for_status.return_value = None
        yield mock 