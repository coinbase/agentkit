"""TaskMarket action provider for delegated work discovery and drafting.

The provider is intentionally read-only/safe by default: it can browse public TaskMarket work
and prepare an auditable task draft, but it does not create, fund, or accept tasks without an
explicit host-application approval flow.
"""

from __future__ import annotations

import json
from typing import Any

import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import BrowseTaskMarketTasksSchema, TaskMarketTaskDraftSchema

TASKMARKET_API_URL = "https://api.taskmarket.dev"


class TaskMarketActionProvider(ActionProvider[WalletProvider]):
    """Provides safe TaskMarket discovery and delegation-draft actions."""

    def __init__(self, api_url: str = TASKMARKET_API_URL):
        """Initialize the TaskMarket provider.

        Args:
            api_url: Base TaskMarket API URL. Override in tests or self-hosted deployments.

        """
        super().__init__("taskmarket", [])
        self.api_url = api_url.rstrip("/")

    @create_action(
        name="browse_taskmarket_tasks",
        description="""Browse public TaskMarket tasks as a delegation option for work that is better handled by external workers. This action is read-only and never spends funds. Use filters such as tag and max_submissions to find relevant, lower-competition tasks.""",
        schema=BrowseTaskMarketTasksSchema,
    )
    def browse_taskmarket_tasks(self, args: dict[str, Any]) -> str:
        """Browse public TaskMarket tasks.

        Args:
            args: limit, optional tag, and optional max_submissions filters.

        Returns:
            JSON string with simplified open-task data or an error payload.

        """
        validated_args = BrowseTaskMarketTasksSchema(**args)
        try:
            response = requests.get(
                f"{self.api_url}/api/tasks",
                params={"status": "open", "limit": validated_args.limit},
                timeout=20,
            )
            if not response.ok:
                return json.dumps(
                    {"success": False, "error": f"HTTP error! status: {response.status_code}"}
                )

            payload = response.json()
            raw_tasks = payload.get("tasks") or payload.get("data", {}).get("tasks") or []
            tasks = []
            for task in raw_tasks:
                tags = task.get("tags") or []
                submission_count = task.get("submissionCount") or task.get("submission_count") or 0
                if validated_args.tag and validated_args.tag.lower() not in [
                    str(tag).lower() for tag in tags
                ]:
                    continue
                if (
                    validated_args.max_submissions is not None
                    and submission_count > validated_args.max_submissions
                ):
                    continue
                task_id = task.get("id")
                tasks.append(
                    {
                        "id": task_id,
                        "url": f"https://taskmarket.dev/task/{task_id}" if task_id else None,
                        "title": task.get("title") or (task.get("description") or "")[:120],
                        "mode": task.get("mode"),
                        "status": task.get("status"),
                        "netReward": task.get("netReward")
                        or task.get("net_reward")
                        or task.get("netRewardBaseUnits")
                        or task.get("rewardBaseUnits"),
                        "submissionCount": submission_count,
                        "awardCount": task.get("awardCount") or task.get("award_count") or 0,
                        "tags": tags,
                        "submissionWindowOpen": task.get("submissionWindowOpen"),
                    }
                )

            return json.dumps(
                {
                    "success": True,
                    "tasks": tasks,
                    "returned": len(tasks),
                    "safety": "read_only_no_spend",
                }
            )
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)})

    @create_action(
        name="prepare_taskmarket_task_draft",
        description="""Prepare a TaskMarket delegation draft with budget, deadline, deliverable, and acceptance criteria. This action does not create or fund a task; the host app must display the draft and get explicit user approval before any wallet/payment action.""",
        schema=TaskMarketTaskDraftSchema,
    )
    def prepare_taskmarket_task_draft(self, args: dict[str, Any]) -> str:
        """Prepare an auditable TaskMarket task draft without spending funds."""
        draft = TaskMarketTaskDraftSchema(**args)
        return json.dumps(
            {
                "success": True,
                "draft": draft.model_dump(),
                "nextStep": "Present this draft to the user for explicit approval before creating or funding a TaskMarket task.",
                "safety": {
                    "spendsFunds": False,
                    "createsTask": False,
                    "requiresExplicitApproval": True,
                },
            }
        )

    def supports_network(self, network: Network) -> bool:
        """TaskMarket discovery/drafting is network agnostic and does not sign transactions."""
        return True


def taskmarket_action_provider(api_url: str = TASKMARKET_API_URL) -> TaskMarketActionProvider:
    """Create a TaskMarket action provider."""
    return TaskMarketActionProvider(api_url=api_url)
