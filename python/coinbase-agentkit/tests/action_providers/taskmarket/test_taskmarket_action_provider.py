"""Tests for the Taskmarket action provider."""

import json
import subprocess
from unittest.mock import Mock

import pytest
import requests
from pydantic import ValidationError

from coinbase_agentkit.action_providers.taskmarket.schemas import (
    BrowseTasksSchema,
    CreateTaskSchema,
    GetTaskSchema,
)
from coinbase_agentkit.action_providers.taskmarket.taskmarket_action_provider import (
    DEFAULT_MAX_SPEND_USDC,
    MAX_SPEND_USDC_ENV_VAR,
    TaskmarketActionProvider,
    taskmarket_action_provider,
)
from coinbase_agentkit.network import Network

from .conftest import MOCK_SECOND_TASK, MOCK_TASK, MOCK_TASK_ID, MOCK_TASKS


def _mock_response(payload, status_code=200):
    """Build a requests.Response-like mock."""
    response = Mock(spec=requests.Response)
    response.status_code = status_code
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


# =========================================================
# Provider registration tests
# =========================================================


def test_provider_name():
    """Test that the provider registers under the expected name."""
    provider = taskmarket_action_provider()
    assert provider.name == "taskmarket"


def test_provider_exposes_expected_actions():
    """Test that the provider exposes the three Taskmarket actions."""
    provider = taskmarket_action_provider()
    action_names = [action.name for action in provider.get_actions(Mock())]
    assert "TaskmarketActionProvider_browse_tasks" in action_names
    assert "TaskmarketActionProvider_get_task" in action_names
    assert "TaskmarketActionProvider_create_task" in action_names


def test_provider_network_agnostic():
    """Test that the provider supports any network."""
    provider = taskmarket_action_provider()
    network = Network(chain_id="8453", network_id="base-mainnet", protocol_family="evm")
    assert provider.supports_network(network) is True
    other_network = Network(chain_id="1", network_id="ethereum-mainnet", protocol_family="evm")
    assert provider.supports_network(other_network) is True


# =========================================================
# Schema tests
# =========================================================


def test_browse_tasks_schema_valid():
    """Test that BrowseTasksSchema validates correctly."""
    valid_inputs = [
        {},  # All defaults
        {"limit": 20},
        {"min_reward_usdc": 1.0, "max_reward_usdc": 25.0, "mode": "bounty", "limit": 100},
    ]
    for input_data in valid_inputs:
        schema = BrowseTasksSchema(**input_data)
        assert schema.limit >= 1
        assert schema.limit <= 100


def test_browse_tasks_schema_invalid():
    """Test that BrowseTasksSchema rejects invalid input."""
    invalid_inputs = [
        {"limit": 0},
        {"limit": 101},
        {"min_reward_usdc": -1},
        {"max_reward_usdc": -0.5},
        {"mode": "unknown_mode"},
    ]
    for input_data in invalid_inputs:
        with pytest.raises(ValidationError):
            BrowseTasksSchema(**input_data)


def test_get_task_schema_valid():
    """Test that GetTaskSchema validates correctly."""
    schema = GetTaskSchema(task_id=MOCK_TASK_ID)
    assert schema.task_id == MOCK_TASK_ID


def test_get_task_schema_invalid():
    """Test that GetTaskSchema rejects missing task id."""
    with pytest.raises(ValidationError):
        GetTaskSchema()


def test_create_task_schema_valid():
    """Test that CreateTaskSchema validates correctly."""
    schema = CreateTaskSchema(
        description="Write a blog post",
        reward_usdc=5.0,
        duration_hours=48,
        mode="bounty",
        confirmation=True,
    )
    assert schema.reward_usdc == 5.0
    assert schema.confirmation is True


def test_create_task_schema_invalid():
    """Test that CreateTaskSchema rejects invalid input."""
    invalid_inputs = [
        {"description": "x", "reward_usdc": 5.0, "duration_hours": 48},  # no confirmation
        {"description": "x", "reward_usdc": 0, "duration_hours": 48, "confirmation": True},
        {"description": "x", "reward_usdc": -1, "duration_hours": 48, "confirmation": True},
        {"description": "x", "reward_usdc": 5.0, "duration_hours": 0, "confirmation": True},
        {
            "description": "x",
            "reward_usdc": 5.0,
            "duration_hours": 48,
            "mode": "nope",
            "confirmation": True,
        },
    ]
    for input_data in invalid_inputs:
        with pytest.raises(ValidationError):
            CreateTaskSchema(**input_data)


# =========================================================
# browse_tasks tests
# =========================================================


def test_browse_tasks_success(mock_requests_get):
    """Test browsing tasks returns filtered open tasks."""
    mock_requests_get.return_value = _mock_response({"tasks": MOCK_TASKS, "hasMore": False})
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.browse_tasks(
            {
                "min_reward_usdc": 1.0,
                "max_reward_usdc": 10.0,
                "mode": "bounty",
                "limit": 20,
            }
        )
    )

    assert response["success"] is True
    assert response["count"] == 1
    assert response["tasks"][0]["id"] == MOCK_TASK_ID
    assert response["tasks"][0]["rewardUsdc"] == 5.0
    assert response["tasks"][0]["mode"] == "bounty"

    # Verify the REST API was called with open status and newest sort
    _, kwargs = mock_requests_get.call_args
    assert kwargs["params"]["status"] == "open"
    assert kwargs["params"]["sort"] == "newest"


def test_browse_tasks_uses_pagination(mock_requests_get):
    """Test that browsing follows the cursor until the limit is reached."""
    page_one = {"tasks": MOCK_TASKS, "hasMore": True, "nextCursor": "2026-08-01T00:00:00.000Z"}
    page_two = {"tasks": [MOCK_SECOND_TASK], "hasMore": False}
    mock_requests_get.side_effect = [_mock_response(page_one), _mock_response(page_two)]
    provider = taskmarket_action_provider()

    response = json.loads(provider.browse_tasks({"limit": 3}))

    assert response["success"] is True
    assert response["count"] == 3
    assert mock_requests_get.call_count == 2
    # The second call must pass the cursor
    _, second_kwargs = mock_requests_get.call_args_list[1]
    assert second_kwargs["params"]["cursor"] == "2026-08-01T00:00:00.000Z"


def test_browse_tasks_stops_when_limit_reached(mock_requests_get):
    """Test that browsing does not fetch more pages once the limit is reached."""
    page_one = {"tasks": MOCK_TASKS, "hasMore": True, "nextCursor": "cursor-1"}
    mock_requests_get.side_effect = [
        _mock_response(page_one),
        _mock_response({"tasks": [], "hasMore": False}),
    ]
    provider = taskmarket_action_provider()

    response = json.loads(provider.browse_tasks({"limit": 2}))

    assert response["success"] is True
    assert response["count"] == 2
    assert mock_requests_get.call_count == 1


def test_browse_tasks_error(mock_requests_get):
    """Test that browse_tasks returns an error JSON when the API call fails."""
    mock_requests_get.side_effect = requests.RequestException("connection refused")
    provider = taskmarket_action_provider()

    response = json.loads(provider.browse_tasks({"limit": 20}))

    assert response["error"] is True
    assert "Failed to browse Taskmarket tasks" in response["message"]


# =========================================================
# get_task tests
# =========================================================


def test_get_task_success(mock_requests_get):
    """Test fetching a single task returns its details."""
    mock_requests_get.return_value = _mock_response(MOCK_TASK)
    provider = taskmarket_action_provider()

    response = json.loads(provider.get_task({"task_id": MOCK_TASK_ID}))

    assert response["success"] is True
    task = response["task"]
    assert task["id"] == MOCK_TASK_ID
    assert task["status"] == "open"
    assert task["rewardUsdc"] == 5.0
    assert task["submissionCount"] == 3
    assert task["expiryTime"] == "2026-09-01T00:00:00.000Z"
    assert task["description"] == MOCK_TASK["description"]
    # The API is called with the task id in the URL
    assert mock_requests_get.call_args[0][0].endswith(f"/tasks/{MOCK_TASK_ID}")


def test_get_task_error(mock_requests_get):
    """Test that get_task returns an error JSON when the task is not found."""
    error_response = Mock(spec=requests.Response)
    error_response.raise_for_status.side_effect = requests.HTTPError("404 Client Error")
    mock_requests_get.return_value = error_response
    provider = taskmarket_action_provider()

    response = json.loads(provider.get_task({"task_id": MOCK_TASK_ID}))

    assert response["error"] is True
    assert "Failed to fetch Taskmarket task" in response["message"]


# =========================================================
# create_task tests
# =========================================================


def test_create_task_requires_confirmation(mock_which, mock_subprocess_run):
    """Test that create_task refuses to run without explicit confirmation."""
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Write a blog post",
                "reward_usdc": 5.0,
                "duration_hours": 48,
                "confirmation": False,
            }
        )
    )

    assert response["error"] is True
    assert "explicit confirmation" in response["message"]
    # The order is echoed so the user sees exactly what would be authorized
    assert response["order"]["description"] == "Write a blog post"
    assert response["order"]["rewardUsdc"] == 5.0
    assert response["order"]["network"] == "Base network (mainnet), paid in USDC"
    # No CLI invocation and no payment
    mock_subprocess_run.assert_not_called()


def test_create_task_respects_spending_limit(monkeypatch, mock_which, mock_subprocess_run):
    """Test that create_task refuses rewards above the configured spending limit."""
    monkeypatch.setenv(MAX_SPEND_USDC_ENV_VAR, "5.0")
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Write a blog post",
                "reward_usdc": 10.0,
                "duration_hours": 48,
                "confirmation": True,
            }
        )
    )

    assert response["error"] is True
    assert "exceeds spending limit" in response["message"]
    assert "10.0 USDC" in response["details"]
    assert "5.0 USDC" in response["details"]
    mock_subprocess_run.assert_not_called()


def test_create_task_uses_default_spending_limit(monkeypatch, mock_which, mock_subprocess_run):
    """Test that the default spending limit is used when the env var is unset."""
    monkeypatch.delenv(MAX_SPEND_USDC_ENV_VAR, raising=False)
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Write a blog post",
                "reward_usdc": DEFAULT_MAX_SPEND_USDC + 1,
                "duration_hours": 48,
                "confirmation": True,
            }
        )
    )

    assert response["error"] is True
    assert "exceeds spending limit" in response["message"]
    mock_subprocess_run.assert_not_called()


def test_create_task_cli_not_found(monkeypatch, mock_which, mock_subprocess_run):
    """Test that create_task errors when the taskmarket CLI is not installed."""
    monkeypatch.delenv(MAX_SPEND_USDC_ENV_VAR, raising=False)
    mock_which.return_value = None
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Write a blog post",
                "reward_usdc": 5.0,
                "duration_hours": 48,
                "confirmation": True,
            }
        )
    )

    assert response["error"] is True
    assert "taskmarket CLI not found" in response["message"]
    assert "npm i -g @lucid-agents/taskmarket" in response["details"]
    mock_subprocess_run.assert_not_called()


def test_create_task_cli_failure(monkeypatch, mock_which, mock_subprocess_run):
    """Test that create_task surfaces the CLI error on non-zero exit."""
    monkeypatch.delenv(MAX_SPEND_USDC_ENV_VAR, raising=False)
    mock_subprocess_run.return_value = Mock(
        returncode=1, stdout="", stderr="Error: insufficient USDC balance"
    )
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Write a blog post",
                "reward_usdc": 5.0,
                "duration_hours": 48,
                "confirmation": True,
            }
        )
    )

    assert response["error"] is True
    assert "taskmarket CLI failed" in response["message"]
    assert "insufficient USDC balance" in response["details"]


def test_create_task_cli_timeout_no_retry(monkeypatch, mock_which, mock_subprocess_run):
    """Test that a CLI timeout returns an error and is never retried."""
    monkeypatch.delenv(MAX_SPEND_USDC_ENV_VAR, raising=False)
    mock_subprocess_run.side_effect = subprocess.TimeoutExpired(
        cmd="taskmarket task create", timeout=120
    )
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Write a blog post",
                "reward_usdc": 5.0,
                "duration_hours": 48,
                "confirmation": True,
            }
        )
    )

    assert response["error"] is True
    assert "timed out" in response["message"]
    assert "Do NOT retry" in response["details"]
    # Exactly one CLI invocation: the payment is never retried on unknown status
    assert mock_subprocess_run.call_count == 1


def test_create_task_success(monkeypatch, mock_which, mock_subprocess_run):
    """Test that create_task delegates to the taskmarket CLI on success."""
    monkeypatch.delenv(MAX_SPEND_USDC_ENV_VAR, raising=False)
    mock_subprocess_run.return_value = Mock(
        returncode=0,
        stdout="Task created successfully: 0xabc123\n",
        stderr="",
    )
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Write a blog post",
                "reward_usdc": 5.0,
                "duration_hours": 48,
                "mode": "bounty",
                "confirmation": True,
            }
        )
    )

    assert response["success"] is True
    assert response["order"]["description"] == "Write a blog post"
    assert response["order"]["rewardUsdc"] == 5.0
    assert response["order"]["durationHours"] == 48
    assert response["order"]["network"] == "Base network (mainnet), paid in USDC"
    assert "0xabc123" in response["cliOutput"]

    # Verify the exact CLI command
    command = mock_subprocess_run.call_args[0][0]
    assert command[0] == "/usr/local/bin/taskmarket"
    assert command[1:3] == ["task", "create"]
    assert "--description" in command
    assert command[command.index("--description") + 1] == "Write a blog post"
    assert "--reward" in command
    assert command[command.index("--reward") + 1] == "5"
    assert "--duration" in command
    assert command[command.index("--duration") + 1] == "48"
    assert "--mode" in command
    assert command[command.index("--mode") + 1] == "bounty"


def test_create_task_success_echoes_network_in_comment(
    monkeypatch, mock_which, mock_subprocess_run
):
    """Test that the network is always part of the order echo."""
    monkeypatch.delenv(MAX_SPEND_USDC_ENV_VAR, raising=False)
    mock_subprocess_run.return_value = Mock(returncode=0, stdout="ok", stderr="")
    provider = taskmarket_action_provider()

    response = json.loads(
        provider.create_task(
            {
                "description": "Design a logo",
                "reward_usdc": 2.5,
                "duration_hours": 24,
                "confirmation": True,
            }
        )
    )

    assert response["success"] is True
    assert response["order"]["network"] == "Base network (mainnet), paid in USDC"
    assert response["order"]["rewardUsdc"] == 2.5
    # Reward is passed to the CLI without trailing zeros
    command = mock_subprocess_run.call_args[0][0]
    assert command[command.index("--reward") + 1] == "2.5"


# =========================================================
# Helper tests
# =========================================================


def test_max_spend_usdc_resolution(monkeypatch):
    """Test spending limit resolution: constructor, env var, then default."""
    provider = taskmarket_action_provider()
    assert provider._get_max_spend_usdc() == DEFAULT_MAX_SPEND_USDC

    monkeypatch.setenv(MAX_SPEND_USDC_ENV_VAR, "25.0")
    assert provider._get_max_spend_usdc() == 25.0

    monkeypatch.setenv(MAX_SPEND_USDC_ENV_VAR, "not-a-number")
    assert provider._get_max_spend_usdc() == DEFAULT_MAX_SPEND_USDC

    explicit = TaskmarketActionProvider(max_spend_usdc=50.0)
    monkeypatch.setenv(MAX_SPEND_USDC_ENV_VAR, "25.0")
    assert explicit._get_max_spend_usdc() == 50.0


def test_reward_conversion():
    """Test that raw integer base-unit rewards convert to USDC."""
    assert TaskmarketActionProvider._reward_to_usdc("64000000") == 64.0
    assert TaskmarketActionProvider._reward_to_usdc("5000000") == 5.0
    assert TaskmarketActionProvider._reward_to_usdc(None) == 0.0
    assert TaskmarketActionProvider._reward_to_usdc("garbage") == 0.0


def test_format_amount():
    """Test CLI amount formatting strips unnecessary trailing zeros."""
    assert TaskmarketActionProvider._format_amount(5.0) == "5"
    assert TaskmarketActionProvider._format_amount(2.5) == "2.5"
    assert TaskmarketActionProvider._format_amount(48) == "48"
    assert TaskmarketActionProvider._format_amount(0.000001) == "0.000001"
