"""Taskmarket action provider for Coinbase AgentKit."""

from __future__ import annotations

import json
import subprocess
from typing import Any

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.wallet_provider import WalletProvider
from coinbase_agentkit.action_providers.action_decorator import create_action
from coinbase_agentkit.action_providers.action_provider import ActionProvider
from .schemas import (
    CreateTaskmarketTaskSchema,
    GetTaskmarketTaskSchema,
    ListTaskmarketSubmissionsSchema,
)


class TaskmarketActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for interacting with Taskmarket bounties and tasks."""

    def __init__(self) -> None:
        super().__init__("taskmarket", [])

    def supports_network(self, network: Network) -> bool:
        """Taskmarket operates on Base Mainnet."""
        return network.chain_id == "8453"

    @staticmethod
    def _run_cli(args: list[str]) -> str:
        """Run a taskmarket CLI command and return stdout."""
        result = subprocess.run(
            ["taskmarket", *args],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            return json.dumps(
                {
                    "error": True,
                    "message": result.stderr.strip() or "CLI command failed",
                    "stdout": result.stdout.strip(),
                }
            )
        try:
            data = json.loads(result.stdout)
            return json.dumps(data)
        except json.JSONDecodeError:
            return json.dumps(
                {
                    "error": True,
                    "message": "Invalid JSON response from taskmarket CLI",
                    "stdout": result.stdout.strip(),
                }
            )

    @create_action(
        name="create_taskmarket_task",
        description="""
    This tool creates a new Taskmarket bounty task on Base Mainnet.

    It takes the following inputs:
    - description: The full task description including deliverables and acceptance criteria
    - reward: Reward in USDC whole units (e.g. '5' for 5 USDC)
    - duration_hours: Task duration in hours from creation
    - deliverables: Summary of expected deliverables
    - max_spend: Maximum total spend cap in USDC whole units (default '0')
    - tags: Comma-separated tags (optional)

    Important notes:
    - The user must explicitly confirm the task details before this action is invoked
    - Taskmarket escrows the reward amount in USDC on Base Mainnet
    - Returns the created task ID and link for tracking
    """,
        schema=CreateTaskmarketTaskSchema,
    )
    def create_taskmarket_task(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        """Create a new Taskmarket task."""
        try:
            validated = CreateTaskmarketTaskSchema(**args)
            cli_args = [
                "task",
                "create",
                "--description",
                validated.description,
                "--reward",
                validated.reward,
                "--duration",
                str(validated.duration_hours),
                "--mode",
                "bounty",
                "--task-visibility",
                "public",
            ]
            if validated.deliverables:
                # Append deliverables to description for context
                cli_args.extend(["--description", validated.description + f"\n\nDeliverables: {validated.deliverables}"])
            if validated.max_spend and validated.max_spend != "0":
                cli_args.extend(["--max-price", validated.max_spend])
            if validated.tags:
                cli_args.extend(["--tags", validated.tags])

            output = self._run_cli(cli_args)
            data = json.loads(output)
            if data.get("error"):
                return output

            return json.dumps(
                {
                    "success": True,
                    "task_id": data.get("data", {}).get("id"),
                    "message": "Task created successfully on Base Mainnet. Reward is escrowed.",
                },
                indent=2,
            )
        except Exception as e:
            return json.dumps({"error": True, "message": f"Failed to create task: {e}"})

    @create_action(
        name="get_taskmarket_task",
        description="""
    This tool retrieves the current status of a Taskmarket task.

    It takes the following inputs:
    - task_id: The Taskmarket task ID to retrieve

    Returns task details including status, reward, expiry, submission count, and any pending actions.
    """,
        schema=GetTaskmarketTaskSchema,
    )
    def get_taskmarket_task(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        """Get a Taskmarket task by ID."""
        try:
            validated = GetTaskmarketTaskSchema(**args)
            output = self._run_cli(["task", "get", validated.task_id])
            data = json.loads(output)
            if data.get("error"):
                return output

            task = data.get("data", {})
            return json.dumps(
                {
                    "success": True,
                    "task_id": task.get("id"),
                    "status": task.get("status"),
                    "reward": task.get("reward"),
                    "net_reward": task.get("netReward"),
                    "expiry": task.get("expiryTime"),
                    "submission_count": task.get("submissionCount"),
                    "pending_actions": [
                        a.get("action") for a in task.get("pendingActions", [])
                    ],
                },
                indent=2,
            )
        except Exception as e:
            return json.dumps({"error": True, "message": f"Failed to get task: {e}"})

    @create_action(
        name="list_taskmarket_submissions",
        description="""
    This tool retrieves submissions for a Taskmarket task for human review.

    It takes the following inputs:
    - task_id: The Taskmarket task ID to list submissions for

    Returns submission IDs, worker addresses, file URLs, submission timestamps, and rejection status.
    Never silently accepts or rejects work.
    """,
        schema=ListTaskmarketSubmissionsSchema,
    )
    def list_taskmarket_submissions(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        """List submissions for a Taskmarket task."""
        try:
            validated = ListTaskmarketSubmissionsSchema(**args)
            output = self._run_cli(["task", "submissions", validated.task_id])
            data = json.loads(output)
            if data.get("error"):
                return output

            submissions = data.get("data", [])
            simplified = []
            for sub in submissions:
                simplified.append(
                    {
                        "submission_id": sub.get("id"),
                        "worker_address": sub.get("workerAddress"),
                        "submitted_at": sub.get("submittedAt"),
                        "rejected_at": sub.get("rejectedAt"),
                        "file_url": sub.get("fileUrl"),
                        "deliverable_hash": sub.get("deliverableHash"),
                    }
                )

            return json.dumps(
                {
                    "success": True,
                    "task_id": validated.task_id,
                    "submissions": simplified,
                    "count": len(simplified),
                },
                indent=2,
            )
        except Exception as e:
            return json.dumps({"error": True, "message": f"Failed to list submissions: {e}"})


def taskmarket_action_provider() -> TaskmarketActionProvider:
    """Create a new TaskmarketActionProvider instance."""
    return TaskmarketActionProvider()
