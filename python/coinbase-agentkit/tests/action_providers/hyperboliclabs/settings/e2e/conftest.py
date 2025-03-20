"""Fixtures for settings service end-to-end tests."""

import pytest

from coinbase_agentkit.action_providers.hyperboliclabs.settings.service import SettingsService


@pytest.fixture
def settings(api_key: str):
    """Create a Settings service instance for testing.

    Args:
        api_key: API key for authentication.

    Returns:
        Settings: A settings service instance initialized with the API key.

    """
    return SettingsService(api_key)
