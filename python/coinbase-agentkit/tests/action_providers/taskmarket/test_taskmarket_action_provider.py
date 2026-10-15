"""Tests for the Taskmarket read-only action provider."""

import json
from decimal import Decimal
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.taskmarket.schemas import ListTasksSchema
from coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider import (
    taskmarket_action_provider,
)


def test_list_tasks_returns_compact_funded_work():
    """List tasks converts USDC units and preserves verification references."""
    response_payload = {
        "tasks": [
            {
                "id": "0x" + "1" * 64,
                "description": "Build a tested adapter",
                "reward": "4500000",
                "netReward": "4162500",
                "expiryTime": "2026-08-22T11:58:25.795Z",
                "mode": "bounty",
                "status": "open",
                "submissionCount": 9,
                "requester": "0x" + "2" * 40,
                "escrowTxHash": "0x" + "3" * 64,
                "submissionWindowOpen": True,
                "tags": ["agents", "python"],
            }
        ],
        "nextCursor": None,
        "hasMore": False,
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = response_payload

        result = taskmarket_action_provider().list_tasks(
            {
                "mode": "bounty",
                "min_reward_usdc": "0.5",
                "deadline_hours": 336,
                "limit": 5,
            }
        )

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["read_only"] is True
    assert parsed["tasks"] == [
        {
            "id": "0x" + "1" * 64,
            "description": "Build a tested adapter",
            "reward_usdc": "4.5",
            "net_reward_usdc": "4.1625",
            "expiry_time": "2026-08-22T11:58:25.795Z",
            "mode": "bounty",
            "status": "open",
            "submission_count": 9,
            "requester": "0x" + "2" * 40,
            "escrow_tx_hash": "0x" + "3" * 64,
            "submission_window_open": True,
            "tags": ["agents", "python"],
            "task_url": "https://taskmarket.dev/tasks/0x" + "1" * 64,
        }
    ]
    mock_get.assert_called_once_with(
        "https://api.taskmarket.dev/api/tasks",
        params={
            "status": "open",
            "mode": "bounty",
            "minReward": "500000",
            "deadlineHours": 336,
            "limit": 5,
            "sort": "deadline_asc",
        },
        timeout=10,
        allow_redirects=False,
    )


def test_get_task_returns_verification_and_worker_actions():
    """Get task exposes escrow evidence without requester-only controls."""
    task_id = "0x" + "a" * 64
    response_payload = {
        "id": task_id,
        "description": "Integrate Taskmarket with an established agent framework",
        "reward": "4500000",
        "netReward": "4162500",
        "expiryTime": "2026-08-22T11:58:25.795Z",
        "mode": "bounty",
        "status": "open",
        "phase": "active",
        "submissionCount": 12,
        "awardCount": 0,
        "requester": "0x" + "b" * 40,
        "escrowTxHash": "0x" + "c" * 64,
        "submissionWindowOpen": True,
        "platformFeeBps": 750,
        "tags": ["agents", "integrations"],
        "pendingActions": [
            {"role": "requester", "action": "accept", "requiresPayment": True},
            {"role": "worker", "action": "submit", "requiresPayment": False},
        ],
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = response_payload

        result = taskmarket_action_provider().get_task({"task_id": task_id})

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["read_only"] is True
    assert parsed["task"]["id"] == task_id
    assert parsed["task"]["reward_usdc"] == "4.5"
    assert parsed["task"]["net_reward_usdc"] == "4.1625"
    assert parsed["task"]["platform_fee_percent"] == "7.5"
    assert parsed["task"]["worker_actions"] == [{"action": "submit", "requires_payment": False}]
    assert "pendingActions" not in parsed["task"]
    mock_get.assert_called_once_with(
        f"https://api.taskmarket.dev/api/tasks/{task_id}",
        timeout=10,
        allow_redirects=False,
    )


def test_provider_is_exported_from_public_package():
    """The factory is available from AgentKit's supported public import surface."""
    from coinbase_agentkit import taskmarket_action_provider as public_factory

    assert public_factory().name == "taskmarket"


def test_list_tasks_reports_http_failure_without_false_results():
    """An API failure is returned explicitly rather than as an empty market."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = False
        mock_get.return_value.status_code = 503

        result = taskmarket_action_provider().list_tasks({"limit": 5})

    assert json.loads(result) == {
        "success": False,
        "error": "Taskmarket returned HTTP 503",
    }


def test_list_tasks_does_not_follow_redirects():
    """The fixed Taskmarket API host cannot redirect the provider elsewhere."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.status_code = 302
        mock_get.return_value.json.return_value = {"tasks": []}

        result = taskmarket_action_provider().list_tasks({"limit": 5})

    assert json.loads(result) == {
        "success": False,
        "error": "Taskmarket returned HTTP 302",
    }


def test_list_tasks_rejects_sub_micro_usdc_precision():
    """USDC filters must not silently round values beyond six decimals."""
    with pytest.raises(ValidationError):
        ListTasksSchema(min_reward_usdc=Decimal("0.0000009"))


def test_get_task_rejects_non_hash_identifier_before_network_access():
    """Task detail URLs cannot be constructed from arbitrary input."""
    with patch("requests.get") as mock_get:
        try:
            taskmarket_action_provider().get_task({"task_id": "../../wallet"})
        except ValidationError:
            pass
        else:
            raise AssertionError("Expected task identifier validation to fail")

    mock_get.assert_not_called()
