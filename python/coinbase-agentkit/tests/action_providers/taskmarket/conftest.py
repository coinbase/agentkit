"""Test fixtures for the Taskmarket action provider tests."""

from unittest.mock import patch

import pytest

MOCK_TASK_ID = "0x" + "ab" * 32
MOCK_TASK = {
    "id": MOCK_TASK_ID,
    "description": "Build a landing page for an agent marketplace",
    "reward": "5000000",  # 5 USDC in base units
    "mode": "bounty",
    "status": "open",
    "submissionCount": 3,
    "expiryTime": "2026-09-01T00:00:00.000Z",
    "tags": ["web", "design"],
    "requester": "0x1234567890123456789012345678901234567890",
    "taskVisibility": "public",
    "submissionVisibility": "public",
}

MOCK_SECOND_TASK = {
    "id": "0x" + "cd" * 32,
    "description": "Generate a benchmark dataset",
    "reward": "30000000",  # 30 USDC in base units
    "mode": "benchmark",
    "status": "open",
    "submissionCount": 1,
    "expiryTime": "2026-09-05T00:00:00.000Z",
    "tags": ["data"],
    "requester": "0x1234567890123456789012345678901234567890",
    "taskVisibility": "public",
    "submissionVisibility": "public",
}

MOCK_TASKS = [MOCK_TASK, MOCK_SECOND_TASK]


@pytest.fixture
def mock_requests_get():
    """Mock requests.get for read-only Taskmarket REST API calls."""
    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.requests.get"
    ) as mock_get:
        yield mock_get


@pytest.fixture
def mock_subprocess_run():
    """Mock subprocess.run for taskmarket CLI calls."""
    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.subprocess.run"
    ) as mock_run:
        yield mock_run


@pytest.fixture
def mock_which():
    """Mock shutil.which so the taskmarket CLI appears installed."""
    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.shutil.which"
    ) as mock_which:
        mock_which.return_value = "/usr/local/bin/taskmarket"
        yield mock_which
