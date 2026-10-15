"""Shared test isolation for the Taskmarket provider."""

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def disable_agentkit_analytics():
    """Keep Taskmarket unit tests local and deterministic."""
    with patch("coinbase_agentkit.action_providers.action_decorator.send_analytics_event"):
        yield
