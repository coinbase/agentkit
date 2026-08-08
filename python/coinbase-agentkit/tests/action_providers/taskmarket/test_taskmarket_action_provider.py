"""Tests for the TaskMarket action provider."""

import json
import sys
from types import ModuleType
from unittest.mock import Mock, patch

# The top-level action_providers package imports all providers, including the optional
# Nillion provider. Some local/aarch64 environments cannot import nilql's native bcl
# extension; these TaskMarket tests do not exercise Nillion, so keep collection focused.
sys.modules.setdefault("nilql", ModuleType("nilql"))

import pytest  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from coinbase_agentkit.action_providers.taskmarket.schemas import (  # noqa: E402
    TaskMarketTaskDraftSchema,
)
from coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider import (  # noqa: E402
    taskmarket_action_provider,
)
from coinbase_agentkit.network import Network  # noqa: E402


def test_prepare_taskmarket_task_draft_requires_human_approval():
    """TaskMarket drafts must preserve explicit user approval for spending."""
    with pytest.raises(ValidationError):
        TaskMarketTaskDraftSchema(
            title="Build a scraper",
            deliverable="Collect the requested public dataset and return a CSV with sources.",
            acceptance_criteria=["CSV has source URLs"],
            max_budget_usdc=2.5,
            deadline_iso="2026-08-14T08:00:00Z",
            requires_human_approval=False,
        )


def test_prepare_taskmarket_task_draft_is_no_spend():
    """Preparing a draft should not create or fund a task."""
    result = taskmarket_action_provider().prepare_taskmarket_task_draft(
        {
            "title": "Verify benchmark results",
            "deliverable": "Run the benchmark suite and submit raw logs plus a short report.",
            "acceptance_criteria": ["Includes raw logs", "Includes reproducible commands"],
            "max_budget_usdc": 5,
            "deadline_iso": "2026-08-14T08:00:00Z",
        }
    )

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["safety"]["spendsFunds"] is False
    assert parsed["safety"]["createsTask"] is False
    assert parsed["safety"]["requiresExplicitApproval"] is True


def test_browse_taskmarket_tasks_filters_low_competition():
    """Browsing tasks should return a simplified, filtered, read-only task list."""
    response = Mock()
    response.ok = True
    response.json.return_value = {
        "tasks": [
            {
                "id": "0x1",
                "description": "Build an agent benchmark harness",
                "mode": "bounty",
                "status": "open",
                "netReward": "5000000",
                "submissionCount": 2,
                "awardCount": 0,
                "tags": ["agents", "benchmark"],
                "submissionWindowOpen": True,
            },
            {
                "id": "0x2",
                "description": "Unrelated video task",
                "mode": "bounty",
                "status": "open",
                "netReward": "1000000",
                "submissionCount": 20,
                "awardCount": 0,
                "tags": ["video"],
                "submissionWindowOpen": True,
            },
        ]
    }

    with patch("requests.get", return_value=response) as mock_get:
        result = taskmarket_action_provider("https://api.taskmarket.dev").browse_taskmarket_tasks(
            {"limit": 10, "tag": "agents", "max_submissions": 5}
        )

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["safety"] == "read_only_no_spend"
    assert parsed["returned"] == 1
    assert parsed["tasks"][0]["id"] == "0x1"
    mock_get.assert_called_once_with(
        "https://api.taskmarket.dev/api/tasks",
        params={"status": "open", "limit": 10},
        timeout=20,
    )


def test_browse_taskmarket_tasks_accepts_nested_data_payload():
    """Browsing should support TaskMarket API payloads that wrap tasks under data.tasks."""
    response = Mock()
    response.ok = True
    response.json.return_value = {
        "data": {
            "tasks": [
                {
                    "id": "0xabc",
                    "description": "Create an agent integration report",
                    "mode": "bounty",
                    "status": "open",
                    "net_reward": "2500000",
                    "submission_count": 3,
                    "award_count": 1,
                    "tags": ["agent"],
                    "submissionWindowOpen": True,
                }
            ]
        }
    }

    with patch("requests.get", return_value=response):
        result = taskmarket_action_provider("https://api.taskmarket.dev").browse_taskmarket_tasks(
            {"limit": 5, "tag": "agent", "max_submissions": 5}
        )

    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["returned"] == 1
    assert parsed["tasks"][0]["id"] == "0xabc"
    assert parsed["tasks"][0]["netReward"] == "2500000"
    assert parsed["tasks"][0]["submissionCount"] == 3
    assert parsed["tasks"][0]["awardCount"] == 1


def test_browse_taskmarket_tasks_returns_safe_error_on_http_failure():
    """HTTP failures should be returned as structured JSON without spending funds."""
    response = Mock()
    response.ok = False
    response.status_code = 503

    with patch("requests.get", return_value=response):
        result = taskmarket_action_provider("https://api.taskmarket.dev").browse_taskmarket_tasks(
            {"limit": 5}
        )

    parsed = json.loads(result)
    assert parsed["success"] is False
    assert "503" in parsed["error"]


def test_taskmarket_provider_supports_any_network():
    """Read-only discovery and drafting do not depend on wallet network."""
    provider = taskmarket_action_provider()
    assert provider.supports_network(Network(chain_id="8453", protocol_family="evm")) is True
