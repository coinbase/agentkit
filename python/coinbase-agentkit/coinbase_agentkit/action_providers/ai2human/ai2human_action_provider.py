"""AI2Human action provider for dispatching human-execution tasks."""

from __future__ import annotations

import json
import os
from typing import Any

import requests

from ...network import Network
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import CreateTaskSchema, ListCategoriesSchema, TaskIdSchema


class AI2HumanAPIError(RuntimeError):
    """Error from the AI2Human API."""

    def __init__(self, message: str, status_code: int, details: Any) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.details = details


def _headers(api_key: str) -> dict[str, str]:
    if not api_key:
        raise AI2HumanAPIError(
            "AI2HUMAN_API_KEY is required. Create one at https://ai2human.io/developers/api-keys.",
            401,
            {"code": "AGENT_API_KEY_REQUIRED"},
        )
    return {"Accept": "application/json", "x-agent-api-key": api_key}


def _request(
    method: str,
    path: str,
    base_url: str,
    api_key: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """Make a synchronous HTTP request to the AI2Human API."""
    url = f"{base_url}{path}"
    resp = requests.request(method, url, headers=_headers(api_key), timeout=30, **kwargs)
    try:
        payload: dict[str, Any] = resp.json()
    except ValueError:
        payload = {"error": f"HTTP {resp.status_code}"}
    if not resp.ok:
        raise AI2HumanAPIError(
            str(payload.get("error") or resp.reason), resp.status_code, payload
        )
    return payload


class AI2HumanActionProvider(ActionProvider):
    """Action provider that lets CDP agents dispatch human-execution tasks via AI2Human."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None) -> None:
        super().__init__("ai2human", [])
        api_key = api_key or os.getenv("AI2HUMAN_API_KEY") or os.getenv("AI2HUMAN_AGENT_KEY") or ""
        base_url = (base_url or os.getenv("AI2HUMAN_BASE_URL") or "https://ai2human.io").rstrip("/")
        self.api_key = api_key
        self.base_url = base_url

    def supports_network(self, network: Network) -> bool:
        return True

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        return _request(method, path, self.base_url, self.api_key, **kwargs)

    @create_action(
        name="ai2human_create_task",
        description=(
            "Dispatch a workflow step that software cannot complete alone to a human operator. "
            "Use for local verification, physical checks, identity-bound actions, document review, "
            "compliance checks, or errands. Payment remains gated by proof verification."
        ),
        schema=CreateTaskSchema,
    )
    def ai2human_create_task(self, args: dict[str, Any]) -> str:
        try:
            result = self._request("POST", "/api/agent/tasks", json=args)
            return json.dumps(result, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @create_action(
        name="ai2human_check_task",
        description="Check human execution, proof verification, and settlement state for a dispatched task.",
        schema=TaskIdSchema,
    )
    def ai2human_check_task(self, args: dict[str, Any]) -> str:
        try:
            result = self._request("GET", f"/api/tasks/{args['task_id']}")
            return json.dumps(result, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @create_action(
        name="ai2human_get_proof",
        description="Retrieve the structured evidence bundle and recorded settlement receipt for a dispatched task.",
        schema=TaskIdSchema,
    )
    def ai2human_get_proof(self, args: dict[str, Any]) -> str:
        try:
            payload = self._request("GET", f"/api/tasks/{args['task_id']}")
            task = payload.get("task") or {}
            campaign = task.get("campaign") or {}
            proof = {
                "task_id": task.get("id"),
                "title": task.get("title"),
                "proof_requirements": campaign.get("proofRequirements") or [],
                "evidence": task.get("evidence") or [],
                "verification_status": task.get("status"),
                "payment": payload.get("payment"),
            }
            return json.dumps(proof, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @create_action(
        name="ai2human_list_categories",
        description="List supported reality-bound task categories and proof types before dispatching human work.",
        schema=ListCategoriesSchema,
    )
    def ai2human_list_categories(self, args: dict[str, Any]) -> str:
        try:
            result = self._request("GET", "/api/agent/tasks/categories")
            return json.dumps(result, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})


def ai2human_action_provider(
    api_key: str | None = None, base_url: str | None = None,
) -> AI2HumanActionProvider:
    """Factory returning an AI2Human ActionProvider for Coinbase AgentKit.

    Usage:
        from coinbase_agentkit import AgentKit, AgentKitConfig, ai2human_action_provider

        agent_kit = AgentKit(AgentKitConfig(
            action_providers=[ai2human_action_provider()],
        ))
    """
    return AI2HumanActionProvider(api_key=api_key, base_url=base_url)
