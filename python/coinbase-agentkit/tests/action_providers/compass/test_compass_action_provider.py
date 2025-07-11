# Compass Toolkit Tests

from unittest.mock import MagicMock

import pytest

from coinbase_agentkit.action_providers.compass.compass_action_provider import (
    compass_action_provider,
)

mock_wallet = MagicMock()
actions = compass_action_provider().get_actions(wallet_provider=mock_wallet)


@pytest.mark.parametrize("action", actions)
def test_compass_tools(action):
    """Test calls every single tool with default args."""
    action.invoke(input=action.example_args)
