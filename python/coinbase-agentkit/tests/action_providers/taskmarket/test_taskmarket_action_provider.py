"""Tests for Taskmarket action provider."""

import json
from unittest.mock import MagicMock, patch

import pytest
from pydantic_core import ValidationError

from coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider import (
    TaskmarketActionProvider,
)
from coinbase_agentkit.action_providers.taskmarket.schemas import (
    CreateTaskmarketTaskSchema,
    GetTaskmarketTaskSchema,
    ListTaskmarketSubmissionsSchema,
)

MOCK_NETWORK_ID = "base-mainnet"
MOCK_WALLET_ADDRESS = "0xDa0B9B9Da39fC816a40634A888069c6A982e8D3D"
MOCK_TASK_ID = "0xfb182f610d57a6c056a8cfd1c9b691a0869c1e0d67c041ac27ed9f42a9c732a1"
MOCK_TASK_STATUS_RESPONSE = json.dumps({
    "ok": True,
    "data": {
        "id": MOCK_TASK_ID,
        "status": "open",
        "reward": "398000",
        "netReward": "368150",
        "expiryTime": "2026-08-25T20:37:34.047Z",
        "submissionCount": 4,
        "pendingActions": [],
    }
})
MOCK_SUBMISSIONS_RESPONSE = json.dumps({
    "ok": True,
    "data": [
        {
            "id": "sub-1",
            "workerAddress": MOCK_WALLET_ADDRESS,
            "submittedAt": "2026-08-11T20:39:47.262Z",
            "rejectedAt": None,
            "fileUrl": "s3://taskmarket/submissions/deliverable.zip",
            "deliverableHash": "0xabc123",
        }
    ]
})
MOCK_CREATE_RESPONSE = json.dumps({
    "ok": True,
    "data": {
        "id": MOCK_TASK_ID,
        "status": "open",
        "reward": "1000000",
    }
})
MOCK_ERROR_RESPONSE = json.dumps({
    "error": True,
    "message": "Insufficient balance",
})


def make_mock_wallet() -> MagicMock:
    """Create a mock wallet provider."""
    wallet = MagicMock()
    wallet.get_address.return_value = MOCK_WALLET_ADDRESS
    network = MagicMock()
    network.chain_id = "8453"
    wallet.get_network.return_value = network
    return wallet


def test_supports_network() -> None:
    """Test network support logic."""
    provider = TaskmarketActionProvider()
    mock_network = MagicMock()
    mock_network.chain_id = "8453"
    assert provider.supports_network(mock_network) is True

    mock_network_wrong = MagicMock()
    mock_network_wrong.chain_id = "1"
    assert provider.supports_network(mock_network_wrong) is False


def test_create_taskmarket_task_schema_valid() -> None:
    """Test valid create task schema."""
    schema = CreateTaskmarketTaskSchema(
        description="Build a Taskmarket integration",
        reward="5",
        duration_hours=48,
        deliverables="PR with tests",
        max_spend="10",
        tags="integration,test",
    )
    assert schema.reward == "5"
    assert schema.duration_hours == 48
    assert schema.max_spend == "10"


def test_create_taskmarket_task_schema_invalid_reward() -> None:
    """Test invalid reward is rejected."""
    with pytest.raises(ValidationError):
        CreateTaskmarketTaskSchema(
            description="Build something",
            reward="-5",
            duration_hours=24,
        )


def test_create_taskmarket_task_schema_invalid_duration() -> None:
    """Test invalid duration is rejected."""
    with pytest.raises(ValidationError):
        CreateTaskmarketTaskSchema(
            description="Build something",
            reward="5",
            duration_hours=-1,
        )


def test_get_taskmarket_task_success() -> None:
    """Test successful task retrieval."""
    provider = TaskmarketActionProvider()
    mock_wallet = make_mock_wallet()

    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.subprocess.run",
        return_value=MagicMock(returncode=0, stdout=MOCK_TASK_STATUS_RESPONSE, stderr=""),
    ):
        response = provider.get_taskmarket_task(mock_wallet, {"task_id": MOCK_TASK_ID})
        data = json.loads(response)
        assert data["success"] is True
        assert data["task_id"] == MOCK_TASK_ID
        assert data["status"] == "open"
        assert data["submission_count"] == 4


def test_list_taskmarket_submissions_success() -> None:
    """Test successful submissions listing."""
    provider = TaskmarketActionProvider()
    mock_wallet = make_mock_wallet()

    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.subprocess.run",
        return_value=MagicMock(returncode=0, stdout=MOCK_SUBMISSIONS_RESPONSE, stderr=""),
    ):
        response = provider.list_taskmarket_submissions(mock_wallet, {"task_id": MOCK_TASK_ID})
        data = json.loads(response)
        assert data["success"] is True
        assert data["count"] == 1
        assert data["submissions"][0]["worker_address"] == MOCK_WALLET_ADDRESS


def test_create_taskmarket_task_success() -> None:
    """Test successful task creation."""
    provider = TaskmarketActionProvider()
    mock_wallet = make_mock_wallet()

    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.subprocess.run",
        return_value=MagicMock(returncode=0, stdout=MOCK_CREATE_RESPONSE, stderr=""),
    ):
        response = provider.create_taskmarket_task(
            mock_wallet,
            {
                "description": "Build a Taskmarket integration",
                "reward": "5",
                "duration_hours": 48,
                "deliverables": "PR with tests",
                "max_spend": "10",
                "tags": "integration",
            },
        )
        data = json.loads(response)
        assert data["success"] is True
        assert data["task_id"] == MOCK_TASK_ID


def test_create_taskmarket_task_cli_failure() -> None:
    """Test task creation handles CLI failure."""
    provider = TaskmarketActionProvider()
    mock_wallet = make_mock_wallet()

    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.subprocess.run",
        return_value=MagicMock(returncode=1, stdout="", stderr="Insufficient balance"),
    ):
        response = provider.create_taskmarket_task(
            mock_wallet,
            {
                "description": "Build something",
                "reward": "5",
                "duration_hours": 24,
            },
        )
        data = json.loads(response)
        assert data["error"] is True
        assert "Insufficient balance" in data["message"]


def test_get_taskmarket_task_cli_failure() -> None:
    """Test task retrieval handles CLI failure."""
    provider = TaskmarketActionProvider()
    mock_wallet = make_mock_wallet()

    with patch(
        "coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider.subprocess.run",
        return_value=MagicMock(returncode=1, stdout="", stderr="Task not found"),
    ):
        response = provider.get_taskmarket_task(mock_wallet, {"task_id": "0xinvalid"})
        data = json.loads(response)
        assert data["error"] is True
        assert "Task not found" in data["message"]
