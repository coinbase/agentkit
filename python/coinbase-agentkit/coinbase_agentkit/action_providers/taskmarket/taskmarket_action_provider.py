"""Taskmarket action provider.

This provider enables agents to interact with the Taskmarket onchain agent task
marketplace (https://taskmarket.dev), which runs on the Base network and pays in
USDC.

Read-only actions (browse_tasks, get_task) call the public Taskmarket REST API
directly over HTTPS and require no authentication.

The write action (create_task) delegates to the official first-party
``taskmarket`` CLI (npm package @lucid-agents/taskmarket). The CLI owns the
wallet, performs x402 payments, and produces EIP-191 signatures. This provider
never reimplements the Taskmarket API, never stores API keys, and never touches
private keys. All spending is gated by an explicit confirmation flag and a
maximum spend limit controlled by the TASKMARKET_MAX_SPEND_USDC environment
variable.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from typing import Any

import requests

from ...network import Network
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import BrowseTasksSchema, CreateTaskSchema, GetTaskSchema

DEFAULT_API_BASE_URL = "https://api.taskmarket.dev/api"
DEFAULT_MAX_SPEND_USDC = 10.0
MAX_SPEND_USDC_ENV_VAR = "TASKMARKET_MAX_SPEND_USDC"
USDC_DECIMALS = 6
TASKMARKET_NETWORK_DESCRIPTION = "Base network (mainnet), paid in USDC"
DEFAULT_CLI_TIMEOUT_SECONDS = 120
DEFAULT_REQUEST_TIMEOUT_SECONDS = 30
MAX_PAGES_PER_BROWSE = 20
MAX_TASKS_PER_PAGE = 50


class TaskmarketActionProvider(ActionProvider):
    """Provides actions for interacting with the Taskmarket marketplace.

    Browse and read actions use the public Taskmarket REST API. The create
    action wraps the official first-party ``taskmarket`` CLI, which owns the
    wallet and performs x402 payments and EIP-191 signing.
    """

    def __init__(
        self,
        api_base_url: str | None = None,
        max_spend_usdc: float | None = None,
        cli_timeout_seconds: int = DEFAULT_CLI_TIMEOUT_SECONDS,
        request_timeout_seconds: int = DEFAULT_REQUEST_TIMEOUT_SECONDS,
    ) -> None:
        """Initialize the Taskmarket action provider.

        Args:
            api_base_url: Optional base URL of the Taskmarket REST API.
                Defaults to the public Taskmarket API.
            max_spend_usdc: Optional maximum spend per task in USDC. When set,
                this overrides the TASKMARKET_MAX_SPEND_USDC environment
                variable. Defaults to 10.0 USDC.
            cli_timeout_seconds: Timeout in seconds for taskmarket CLI calls.
            request_timeout_seconds: Timeout in seconds for REST API calls.

        """
        super().__init__("taskmarket", [])
        self._api_base_url = (api_base_url or DEFAULT_API_BASE_URL).rstrip("/")
        self._max_spend_usdc = max_spend_usdc
        self._cli_timeout_seconds = cli_timeout_seconds
        self._request_timeout_seconds = request_timeout_seconds

    @create_action(
        name="browse_tasks",
        description="""
Browse open tasks on the Taskmarket onchain task marketplace (Base network, USDC rewards).

Calls the public Taskmarket REST API (no authentication required) and returns open tasks
sorted by newest first. Optional filters:
- max_reward_usdc: only return tasks with a reward at or below this amount (USDC)
- min_reward_usdc: only return tasks with a reward at or above this amount (USDC)
- mode: only return tasks with this mode (bounty, claim, pitch, benchmark, auction)
- limit: maximum number of tasks to return (default 20, max 100)

Rewards are reported in whole USDC units (the API stores rewards as integer base units;
USDC amount = reward / 1e6).
""",
        schema=BrowseTasksSchema,
    )
    def browse_tasks(self, args: dict[str, Any]) -> str:
        """Browse open tasks on the Taskmarket marketplace.

        Args:
            args: BrowseTasksSchema fields: max_reward_usdc, min_reward_usdc,
                mode, limit.

        Returns:
            str: JSON string with the list of matching open tasks.

        """
        try:
            validated_args = BrowseTasksSchema(**args)
            raw_tasks = self._fetch_open_tasks(validated_args.limit)

            tasks = []
            for raw_task in raw_tasks:
                reward_usdc = self._reward_to_usdc(raw_task.get("reward"))
                if (
                    validated_args.min_reward_usdc is not None
                    and reward_usdc < validated_args.min_reward_usdc
                ):
                    continue
                if (
                    validated_args.max_reward_usdc is not None
                    and reward_usdc > validated_args.max_reward_usdc
                ):
                    continue
                if (
                    validated_args.mode is not None
                    and (raw_task.get("mode") or "") != validated_args.mode
                ):
                    continue
                tasks.append(self._summarize_task(raw_task))

            return json.dumps(
                {
                    "success": True,
                    "tasks": tasks,
                    "count": len(tasks),
                    "filters": {
                        "minRewardUsdc": validated_args.min_reward_usdc,
                        "maxRewardUsdc": validated_args.max_reward_usdc,
                        "mode": validated_args.mode,
                    },
                },
                indent=2,
            )
        except Exception as error:
            return json.dumps(
                {
                    "error": True,
                    "message": "Failed to browse Taskmarket tasks",
                    "details": str(error),
                },
                indent=2,
            )

    @create_action(
        name="get_task",
        description="""
Fetch the full details of a single Taskmarket task by its id.

Calls the public Taskmarket REST API (no authentication required). The task id is a
0x-prefixed 32-byte hex string (e.g. 0xb4e0e215...b152e3). Returns the task id, status,
reward in USDC, expiry time, submission count, mode, requester, tags, and description.
""",
        schema=GetTaskSchema,
    )
    def get_task(self, args: dict[str, Any]) -> str:
        """Fetch a single task from the Taskmarket marketplace.

        Args:
            args: GetTaskSchema fields: task_id.

        Returns:
            str: JSON string with the task details.

        """
        try:
            validated_args = GetTaskSchema(**args)
            response = requests.get(
                f"{self._api_base_url}/tasks/{validated_args.task_id}",
                timeout=self._request_timeout_seconds,
            )
            response.raise_for_status()
            task = response.json()
            return json.dumps(
                {
                    "success": True,
                    "task": self._summarize_task(task),
                },
                indent=2,
            )
        except Exception as error:
            return json.dumps(
                {
                    "error": True,
                    "message": "Failed to fetch Taskmarket task",
                    "details": str(error),
                },
                indent=2,
            )

    @create_action(
        name="create_task",
        description="""
Create a new task on the Taskmarket onchain task marketplace (Base network, USDC rewards).

This action WRITES ONCHAIN AND SPENDS USDC. It delegates to the official first-party
'taskmarket' CLI (npm package @lucid-agents/taskmarket), which owns the wallet, performs
the x402 payment, and signs the task with EIP-191. This provider never reimplements the
Taskmarket API, never stores API keys, and never handles private keys.

Required inputs:
- description: the exact task description that will be posted onchain
- reward_usdc: the task reward in whole USDC units (escrowed onchain)
- duration_hours: the task duration in hours
- confirmation: MUST be true to authorize the payment. If false, the action returns a
  preview and spends nothing.

Safety gates (enforced before any payment):
1. Explicit confirmation: confirmation must be true.
2. Spending limit: the reward must not exceed TASKMARKET_MAX_SPEND_USDC (default 10.0 USDC).
3. The exact description, reward, duration, and network are echoed in every response.

If the CLI times out, the settlement status of the payment is unknown: do NOT retry this
action. Check the task and wallet status first (taskmarket task search, taskmarket wallet
balance).
""",
        schema=CreateTaskSchema,
    )
    def create_task(self, args: dict[str, Any]) -> str:
        """Create a task on the Taskmarket marketplace via the first-party CLI.

        Args:
            args: CreateTaskSchema fields: description, reward_usdc,
                duration_hours, mode, confirmation.

        Returns:
            str: JSON string with the creation result, including an echo of the
                exact order (description, reward, duration, network).

        """
        try:
            validated_args = CreateTaskSchema(**args)

            order = {
                "description": validated_args.description,
                "rewardUsdc": validated_args.reward_usdc,
                "durationHours": validated_args.duration_hours,
                "mode": validated_args.mode,
                "network": TASKMARKET_NETWORK_DESCRIPTION,
            }

            if not validated_args.confirmation:
                return json.dumps(
                    {
                        "error": True,
                        "message": "Task creation requires explicit confirmation",
                        "order": order,
                        "details": (
                            "Set confirmation to true to authorize creating this task. "
                            "No payment was made and no funds were spent."
                        ),
                    },
                    indent=2,
                )

            max_spend_usdc = self._get_max_spend_usdc()
            if validated_args.reward_usdc > max_spend_usdc:
                return json.dumps(
                    {
                        "error": True,
                        "message": "Task reward exceeds spending limit",
                        "order": order,
                        "details": (
                            f"The requested reward of {validated_args.reward_usdc} USDC exceeds the "
                            f"maximum allowed spend of {max_spend_usdc} USDC configured via the "
                            f"{MAX_SPEND_USDC_ENV_VAR} environment variable. No payment was made."
                        ),
                    },
                    indent=2,
                )

            cli_path = shutil.which("taskmarket")
            if cli_path is None:
                return json.dumps(
                    {
                        "error": True,
                        "message": "taskmarket CLI not found",
                        "order": order,
                        "details": (
                            "The first-party taskmarket CLI is required to create tasks. "
                            "Install it with 'npm i -g @lucid-agents/taskmarket' and run "
                            "'taskmarket init' to set up the wallet. No payment was made."
                        ),
                    },
                    indent=2,
                )

            command = [
                cli_path,
                "task",
                "create",
                "--description",
                validated_args.description,
                "--reward",
                self._format_amount(validated_args.reward_usdc),
                "--duration",
                self._format_amount(validated_args.duration_hours),
            ]
            if validated_args.mode is not None:
                command.extend(["--mode", validated_args.mode])

            try:
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=self._cli_timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                return json.dumps(
                    {
                        "error": True,
                        "message": "taskmarket CLI timed out",
                        "order": order,
                        "details": (
                            "The taskmarket CLI did not finish within the timeout. The settlement "
                            "status of the payment is unknown. Do NOT retry this action; check the "
                            "task and wallet status first (taskmarket task search, taskmarket wallet "
                            "balance)."
                        ),
                    },
                    indent=2,
                )

            if result.returncode != 0:
                error_output = (result.stderr or result.stdout or "Unknown CLI error").strip()
                return json.dumps(
                    {
                        "error": True,
                        "message": "taskmarket CLI failed",
                        "order": order,
                        "details": error_output,
                    },
                    indent=2,
                )

            cli_output = (result.stdout or "").strip()
            return json.dumps(
                {
                    "success": True,
                    "message": "Task created on Taskmarket via the first-party CLI",
                    "order": order,
                    "cliOutput": cli_output,
                },
                indent=2,
            )
        except Exception as error:
            return json.dumps(
                {
                    "error": True,
                    "message": "Failed to create Taskmarket task",
                    "details": str(error),
                },
                indent=2,
            )

    def supports_network(self, network: Network) -> bool:
        """Check if this provider supports the specified network.

        The marketplace runs on Base mainnet, but the read-only actions use the
        public REST API and the create action delegates to the taskmarket CLI,
        which owns the wallet and handles the network itself. The provider is
        therefore network-agnostic from the agent's perspective.

        Args:
            network: The network to check.

        Returns:
            bool: Always True as Taskmarket is network-agnostic for agents.

        """
        return True

    def _fetch_open_tasks(self, limit: int) -> list[dict[str, Any]]:
        """Fetch open tasks from the Taskmarket REST API with pagination.

        Args:
            limit: Maximum number of tasks to fetch.

        Returns:
            list[dict[str, Any]]: The raw task objects, newest first.

        """
        tasks: list[dict[str, Any]] = []
        cursor: str | None = None
        for _ in range(MAX_PAGES_PER_BROWSE):
            if len(tasks) >= limit:
                break
            params: dict[str, Any] = {
                "status": "open",
                "sort": "newest",
                "limit": min(MAX_TASKS_PER_PAGE, limit - len(tasks)),
            }
            if cursor is not None:
                params["cursor"] = cursor
            response = requests.get(
                f"{self._api_base_url}/tasks",
                params=params,
                timeout=self._request_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            tasks.extend(payload.get("tasks", []))
            if not payload.get("hasMore") or not payload.get("nextCursor"):
                break
            cursor = payload["nextCursor"]
        return tasks[:limit]

    @staticmethod
    def _reward_to_usdc(reward: Any) -> float:
        """Convert a raw Taskmarket reward (integer base units) to USDC.

        Args:
            reward: The raw reward value from the API, an integer string in
                base units.

        Returns:
            float: The reward in whole USDC units, or 0.0 if unparseable.

        """
        try:
            return int(reward) / (10**USDC_DECIMALS)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _summarize_task(task: dict[str, Any]) -> dict[str, Any]:
        """Build a compact summary of a task for agent consumption.

        Args:
            task: The raw task object from the Taskmarket API.

        Returns:
            dict[str, Any]: A summary with id, description, reward, mode,
                status, submission count, expiry, tags, and requester.

        """
        return {
            "id": task.get("id"),
            "description": task.get("description"),
            "rewardUsdc": TaskmarketActionProvider._reward_to_usdc(task.get("reward")),
            "mode": task.get("mode"),
            "status": task.get("status"),
            "submissionCount": task.get("submissionCount"),
            "expiryTime": task.get("expiryTime"),
            "tags": task.get("tags"),
            "requester": task.get("requester"),
        }

    def _get_max_spend_usdc(self) -> float:
        """Resolve the maximum allowed spend per task in USDC.

        Precedence: constructor argument, then TASKMARKET_MAX_SPEND_USDC
        environment variable, then the default of 10.0 USDC.

        Returns:
            float: The maximum allowed spend in USDC.

        """
        if self._max_spend_usdc is not None:
            return self._max_spend_usdc
        raw = os.getenv(MAX_SPEND_USDC_ENV_VAR)
        if raw is None or raw.strip() == "":
            return DEFAULT_MAX_SPEND_USDC
        try:
            return float(raw)
        except ValueError:
            return DEFAULT_MAX_SPEND_USDC

    @staticmethod
    def _format_amount(value: float) -> str:
        """Format a numeric amount for the CLI without trailing zeros.

        Args:
            value: The amount to format.

        Returns:
            str: The formatted amount string.

        """
        return f"{value:.6f}".rstrip("0").rstrip(".")


def taskmarket_action_provider(
    api_base_url: str | None = None,
    max_spend_usdc: float | None = None,
    cli_timeout_seconds: int = DEFAULT_CLI_TIMEOUT_SECONDS,
    request_timeout_seconds: int = DEFAULT_REQUEST_TIMEOUT_SECONDS,
) -> TaskmarketActionProvider:
    """Create a new Taskmarket action provider.

    Args:
        api_base_url: Optional base URL of the Taskmarket REST API.
            Defaults to the public Taskmarket API.
        max_spend_usdc: Optional maximum spend per task in USDC. When set,
            this overrides the TASKMARKET_MAX_SPEND_USDC environment variable.
            Defaults to 10.0 USDC.
        cli_timeout_seconds: Timeout in seconds for taskmarket CLI calls.
        request_timeout_seconds: Timeout in seconds for REST API calls.

    Returns:
        TaskmarketActionProvider: A new Taskmarket action provider instance.

    """
    return TaskmarketActionProvider(
        api_base_url=api_base_url,
        max_spend_usdc=max_spend_usdc,
        cli_timeout_seconds=cli_timeout_seconds,
        request_timeout_seconds=request_timeout_seconds,
    )
