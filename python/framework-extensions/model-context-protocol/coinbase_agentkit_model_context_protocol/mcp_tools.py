"""Model Context Protocol (MCP) tools conversion for AgentKit."""

import json
import logging
from collections.abc import Awaitable, Callable, Sequence
from typing import Any, NamedTuple

import anyio
from mcp.shared.exceptions import McpError
from mcp.types import INVALID_PARAMS, CallToolResult, ErrorData, TextContent, Tool
from pydantic import ValidationError

from coinbase_agentkit import AgentKit

logger = logging.getLogger("coinbase_agentkit_model_context_protocol")


class AgentKitMcpTools(NamedTuple):
    """Container for MCP tools and dispatch handler."""

    tools: list[Tool]
    tool_handler: Callable[[str, dict[str, Any] | None], Awaitable[CallToolResult]]


def _format_result(result: Any) -> str:
    """Format action invocation result without redundant double-serialization.

    Args:
        result: The raw action return value.

    Returns:
        Formatted string output for MCP content.

    """
    if isinstance(result, str):
        return result
    if result is None:
        return "Success"
    if isinstance(result, dict | list):
        return json.dumps(result)
    return str(result)


def get_mcp_tools(
    agent_kit: AgentKit,
    *,
    allowed_actions: Sequence[str],
) -> AgentKitMcpTools:
    """Convert allowlisted AgentKit actions to Model Context Protocol (MCP) tools.

    This function inspects an AgentKit instance and converts explicitly allowlisted
    actions into MCP Tool definitions paired with an asynchronous execution handler.
    Actions not present in `allowed_actions` will not be advertised or callable.

    Args:
        agent_kit: An initialized AgentKit instance.
        allowed_actions: Mandatory sequence of action names permitted for MCP exposure.

    Returns:
        AgentKitMcpTools: Named tuple containing:
            - tools: List of Tool objects ready for tools/list registration.
            - tool_handler: Asynchronous callable to dispatch tools/call requests.

    Raises:
        ValueError: If duplicate action names exist in AgentKit, if duplicate entries
            exist in `allowed_actions`, or if an allowlisted action is not available.
        McpError: When an unknown or non-allowlisted tool name is invoked.

    """
    all_actions = agent_kit.get_actions()

    # Detect duplicate action names in the underlying AgentKit action list
    seen_action_names: set[str] = set()
    for action in all_actions:
        if action.name in seen_action_names:
            raise ValueError(f"Duplicate action name detected in AgentKit actions: '{action.name}'")
        seen_action_names.add(action.name)

    # Detect duplicate entries in allowed_actions
    seen_allowed: set[str] = set()
    for name in allowed_actions:
        if name in seen_allowed:
            raise ValueError(f"Duplicate entry in allowed_actions: '{name}'")
        seen_allowed.add(name)

    # Reject allowlist entries that do not exist in AgentKit's available actions
    for name in allowed_actions:
        if name not in seen_action_names:
            raise ValueError(
                f"Allowed action '{name}' is not available in AgentKit. "
                f"Available actions: {sorted(seen_action_names)}"
            )

    # Filter actions to only explicitly allowlisted ones
    allowed_set = set(allowed_actions)
    filtered_actions = [action for action in all_actions if action.name in allowed_set]
    action_map = {action.name: action for action in filtered_actions}

    tools: list[Tool] = []
    for action in filtered_actions:
        if action.args_schema is not None:
            schema = action.args_schema.model_json_schema()
        else:
            schema = {"type": "object", "properties": {}, "additionalProperties": False}

        tools.append(
            Tool(
                name=action.name,
                description=action.description or "",
                inputSchema=schema,
            )
        )

    async def tool_handler(name: str, arguments: dict[str, Any] | None = None) -> CallToolResult:
        action = action_map.get(name)
        if not action:
            raise McpError(
                ErrorData(
                    code=INVALID_PARAMS,
                    message=f"Tool '{name}' not found.",
                )
            )

        call_args = arguments if arguments is not None else {}

        # Validate arguments against Pydantic schema when defined
        if action.args_schema is not None:
            try:
                validated_model = action.args_schema.model_validate(call_args)
                call_args = validated_model.model_dump()
            except ValidationError:
                # Return generic safe validation error without echoing custom validation messages,
                # rejected input values, or dynamic validation locations
                logger.warning("Argument validation failed for tool '%s'", name)
                return CallToolResult(
                    isError=True,
                    content=[
                        TextContent(
                            type="text",
                            text=(
                                f"Invalid arguments for tool '{name}'. "
                                "Check the tool's input schema and required fields."
                            ),
                        )
                    ],
                )

        # Offload synchronous action invocation to worker thread to avoid blocking event loop
        try:
            raw_result = await anyio.to_thread.run_sync(action.invoke, call_args)
            return CallToolResult(
                isError=False,
                content=[TextContent(type="text", text=_format_result(raw_result))],
            )
        except Exception as e:
            # Safe internal diagnostic log: record only tool name and exception type
            # Do NOT log raw exception strings, tracebacks, or arguments
            logger.warning(
                "Tool execution failed for '%s' with exception type '%s'",
                name,
                type(e).__name__,
            )
            # Safe generic client-facing message: do NOT expose raw str(e), filesystem paths,
            # URLs, tokens, credentials, or stack traces
            return CallToolResult(
                isError=True,
                content=[
                    TextContent(
                        type="text",
                        text=f"Error executing tool '{name}': {type(e).__name__} occurred during action execution.",
                    )
                ],
            )

    return AgentKitMcpTools(tools=tools, tool_handler=tool_handler)
