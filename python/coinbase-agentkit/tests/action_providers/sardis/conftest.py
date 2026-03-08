"""Test fixtures for Sardis action provider tests."""

import pytest

MOCK_API_KEY = "sk_test_sardis_mock_key_123"
MOCK_WALLET_ID = "wal_test_mock_wallet_456"
MOCK_BASE_URL = "https://api.sardis.sh/v2"


@pytest.fixture
def mock_env(monkeypatch):
    """Set up mock environment variables for Sardis credentials."""
    monkeypatch.setenv("SARDIS_API_KEY", MOCK_API_KEY)
    monkeypatch.setenv("SARDIS_WALLET_ID", MOCK_WALLET_ID)


@pytest.fixture
def mock_provider(mock_env):
    """Create a Sardis action provider with mock credentials."""
    from coinbase_agentkit.action_providers.sardis.sardis_action_provider import (
        sardis_action_provider,
    )

    return sardis_action_provider()
