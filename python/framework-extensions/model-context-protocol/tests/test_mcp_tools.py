"""Focused unit tests and security assertions for AgentKit MCP tools adapter."""

import json
import logging
import threading
from unittest.mock import MagicMock

import pytest
from mcp.shared.exceptions import McpError
from mcp.types import INVALID_PARAMS, CallToolResult, TextContent, Tool

from coinbase_agentkit import Action, AgentKit
from coinbase_agentkit_model_context_protocol import AgentKitMcpTools, get_mcp_tools
from tests.conftest import MockActionProvider


def test_get_mcp_tools_structure(agent_kit: AgentKit, all_action_names: list[str]) -> None:
    """Test that get_mcp_tools returns properly typed NamedTuple and unpacks cleanly."""
    mcp_tools = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    assert isinstance(mcp_tools, AgentKitMcpTools)
    assert isinstance(mcp_tools.tools, list)
    assert callable(mcp_tools.tool_handler)

    # NamedTuple unpacking check
    tools, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    assert len(tools) == len(agent_kit.get_actions())
    assert callable(handler)


def test_tool_definitions_and_schema_translation(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify tool definition attributes and Pydantic V2 JSON schema translation."""
    tools, _ = get_mcp_tools(agent_kit, allowed_actions=all_action_names)

    # 1. Action with required fields
    add_tool = next(t for t in tools if t.name == "MockActionProvider_add_numbers")
    assert isinstance(add_tool, Tool)
    assert add_tool.description == "Add two numbers together"
    schema = add_tool.inputSchema
    assert schema["type"] == "object"
    assert "a" in schema["properties"]
    assert "b" in schema["properties"]
    assert schema["properties"]["a"]["type"] == "integer"
    assert schema["required"] == ["a", "b"]

    # 2. Action without schema
    list_tool = next(t for t in tools if t.name == "MockActionProvider_list_items")
    assert list_tool.inputSchema == {
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    }

    # 3. Action with enums and nested schema ($defs and $ref preserved)
    complex_tool = next(t for t in tools if t.name == "MockActionProvider_complex_action")
    complex_schema = complex_tool.inputSchema
    assert "$defs" in complex_schema
    assert "Priority" in complex_schema["$defs"]
    assert complex_schema["$defs"]["Priority"]["enum"] == ["low", "high"]
    assert "NestedMetadata" in complex_schema["$defs"]
    assert complex_schema["properties"]["priority"]["$ref"] == "#/$defs/Priority"


@pytest.mark.asyncio
async def test_tool_handler_success_string(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify successful execution returns unquoted string output."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    result = await handler("MockActionProvider_add_numbers", {"a": 15, "b": 27})

    assert isinstance(result, CallToolResult)
    assert result.isError is False
    assert len(result.content) == 1
    assert isinstance(result.content[0], TextContent)
    # Ensure NO extra outer quotes from double-serialization
    assert result.content[0].text == "Result: 42"


@pytest.mark.asyncio
async def test_tool_handler_success_dictionary(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify dictionary return value is serialized to JSON string."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    payload = {
        "label": "test_run",
        "priority": "high",
        "metadata": {"tag": "base", "count": 3},
    }
    result = await handler("MockActionProvider_complex_action", payload)

    assert result.isError is False
    assert isinstance(result.content[0], TextContent)
    data = json.loads(result.content[0].text)
    assert data["status"] == "success"
    assert data["echo"]["label"] == "test_run"
    assert data["echo"]["priority"] == "high"
    assert data["echo"]["metadata"]["tag"] == "base"


@pytest.mark.asyncio
async def test_tool_handler_success_list(agent_kit: AgentKit, all_action_names: list[str]) -> None:
    """Verify list return value is serialized to JSON array string."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    result = await handler("MockActionProvider_list_items", {})

    assert result.isError is False
    assert isinstance(result.content[0], TextContent)
    items = json.loads(result.content[0].text)
    assert items == ["item_alpha", "item_beta"]


@pytest.mark.asyncio
async def test_tool_handler_success_scalar(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify scalar number return value is converted to plain string."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    result = await handler("MockActionProvider_scalar_result", {})

    assert result.isError is False
    assert isinstance(result.content[0], TextContent)
    assert result.content[0].text == "42"


@pytest.mark.asyncio
async def test_tool_handler_success_none(agent_kit: AgentKit, all_action_names: list[str]) -> None:
    """Verify None return value translates to 'Success' text."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    result = await handler("MockActionProvider_none_result", {})

    assert result.isError is False
    assert isinstance(result.content[0], TextContent)
    assert result.content[0].text == "Success"


@pytest.mark.asyncio
async def test_tool_handler_unknown_tool_protocol_error(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify unknown tool name raises SDK McpError with INVALID_PARAMS protocol error code."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)

    with pytest.raises(McpError) as exc_info:
        await handler("unregistered_tool_name", {})

    err = exc_info.value.error
    assert err.code == INVALID_PARAMS
    assert "Tool 'unregistered_tool_name' not found." in err.message


@pytest.mark.asyncio
async def test_tool_handler_thread_offloading(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify synchronous actions are offloaded to worker threads and do not block async loop."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)
    main_thread_id = threading.get_ident()

    result = await handler("MockActionProvider_slow_thread_action", {})
    assert result.isError is False
    assert isinstance(result.content[0], TextContent)

    data = json.loads(result.content[0].text)
    action_thread_id = data["thread_id"]

    # Must run on a worker thread, not the main asyncio thread
    assert action_thread_id != main_thread_id


@pytest.mark.asyncio
async def test_tool_handler_none_arguments(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify handler gracefully accepts arguments=None."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=all_action_names)

    # 1. Action requiring arguments fails validation cleanly with arguments=None
    result_with_schema = await handler("MockActionProvider_add_numbers", None)
    assert result_with_schema.isError is True
    assert isinstance(result_with_schema.content[0], TextContent)
    assert (
        result_with_schema.content[0].text
        == "Invalid arguments for tool 'MockActionProvider_add_numbers'. "
        "Check the tool's input schema and required fields."
    )

    # 2. Action requiring no arguments succeeds with arguments=None
    result_no_schema = await handler("MockActionProvider_list_items", None)
    assert result_no_schema.isError is False
    assert isinstance(result_no_schema.content[0], TextContent)


# ==============================================================================
# Security-focused hardening tests
# ==============================================================================


def test_allowlisted_action_advertised_and_callable(agent_kit: AgentKit) -> None:
    """Verify that only the explicitly allowlisted action is advertised in the tool list."""
    tools, _ = get_mcp_tools(agent_kit, allowed_actions=["MockActionProvider_add_numbers"])

    assert len(tools) == 1
    assert tools[0].name == "MockActionProvider_add_numbers"


def test_non_allowlisted_action_not_advertised(agent_kit: AgentKit) -> None:
    """Verify that non-allowlisted actions are omitted from the advertised tools list."""
    tools, _ = get_mcp_tools(agent_kit, allowed_actions=["MockActionProvider_add_numbers"])
    advertised_names = {t.name for t in tools}

    assert "MockActionProvider_complex_action" not in advertised_names
    assert "MockActionProvider_list_items" not in advertised_names
    assert "MockActionProvider_failing_action" not in advertised_names


@pytest.mark.asyncio
async def test_client_guessing_excluded_action_cannot_invoke(agent_kit: AgentKit) -> None:
    """Verify that guessing an excluded action name raises protocol McpError."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=["MockActionProvider_add_numbers"])

    with pytest.raises(McpError) as exc_info:
        await handler("MockActionProvider_complex_action", {"label": "test"})

    err = exc_info.value.error
    assert err.code == INVALID_PARAMS
    assert "Tool 'MockActionProvider_complex_action' not found." in err.message


@pytest.mark.asyncio
async def test_excluded_action_invoke_never_called(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that attempting to invoke an excluded action never calls underlying action code."""
    _, handler = get_mcp_tools(agent_kit, allowed_actions=["MockActionProvider_add_numbers"])

    with pytest.raises(McpError):
        await handler("MockActionProvider_list_items", {})

    assert mock_provider.call_counts["list_items"] == 0


def test_empty_allowlist_exposes_zero_actions(agent_kit: AgentKit) -> None:
    """Verify that passing an empty allowlist exposes zero tools."""
    tools, _ = get_mcp_tools(agent_kit, allowed_actions=[])
    assert len(tools) == 0


def test_unknown_allowlist_entry_fails(agent_kit: AgentKit) -> None:
    """Verify that unknown allowlist entries raise a descriptive ValueError."""
    with pytest.raises(ValueError, match="Allowed action 'unrecognized_action' is not available"):
        get_mcp_tools(agent_kit, allowed_actions=["unrecognized_action"])


def test_duplicate_allowlist_entry_fails(agent_kit: AgentKit) -> None:
    """Verify that duplicate entries in allowed_actions raise a ValueError."""
    with pytest.raises(ValueError, match="Duplicate entry in allowed_actions"):
        get_mcp_tools(
            agent_kit,
            allowed_actions=[
                "MockActionProvider_add_numbers",
                "MockActionProvider_add_numbers",
            ],
        )


def test_duplicate_action_names_in_agentkit_fail() -> None:
    """Verify that duplicate action names in AgentKit actions raise a clear ValueError."""
    mock_agent_kit = MagicMock(spec=AgentKit)
    action1 = Action(
        name="duplicate_tool",
        description="first",
        args_schema=None,
        invoke=lambda args: "1",
    )
    action2 = Action(
        name="duplicate_tool",
        description="second",
        args_schema=None,
        invoke=lambda args: "2",
    )
    mock_agent_kit.get_actions.return_value = [action1, action2]

    with pytest.raises(ValueError, match="Duplicate action name detected in AgentKit actions"):
        get_mcp_tools(mock_agent_kit, allowed_actions=["duplicate_tool"])


@pytest.mark.asyncio
async def test_validation_errors_do_not_expose_sensitive_input(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that ordinary validation errors return generic text without echoing rejected input."""
    sensitive_token = "SUPER_SECRET_TOKEN_XYZ_12345"
    _, handler = get_mcp_tools(agent_kit, allowed_actions=["MockActionProvider_add_numbers"])

    result = await handler("MockActionProvider_add_numbers", {"a": sensitive_token, "b": 10})

    assert isinstance(result, CallToolResult)
    assert result.isError is True
    assert isinstance(result.content[0], TextContent)

    # The sensitive token must NEVER be reflected back in the client error
    assert sensitive_token not in result.content[0].text
    # Client receives a clean, generic message
    expected_msg = (
        "Invalid arguments for tool 'MockActionProvider_add_numbers'. "
        "Check the tool's input schema and required fields."
    )
    assert result.content[0].text == expected_msg
    # Underlying action must not have been called
    assert mock_provider.call_counts["add_numbers"] == 0


@pytest.mark.asyncio
async def test_custom_validation_error_message_does_not_leak_secret(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that custom validation messages containing sensitive secrets are suppressed."""
    mock_secret = "MOCK_SECRET_CREDENTIAL_77777"
    _, handler = get_mcp_tools(
        agent_kit, allowed_actions=["MockActionProvider_custom_validate_action"]
    )

    result = await handler(
        "MockActionProvider_custom_validate_action", {"token": f"prefix_{mock_secret}"}
    )

    assert isinstance(result, CallToolResult)
    assert result.isError is True
    assert isinstance(result.content[0], TextContent)

    # Must NOT disclose secret or custom validator message
    assert mock_secret not in result.content[0].text
    assert "Custom validation failure" not in result.content[0].text

    # Must return generic message
    expected_msg = (
        "Invalid arguments for tool 'MockActionProvider_custom_validate_action'. "
        "Check the tool's input schema and required fields."
    )
    assert result.content[0].text == expected_msg
    # Underlying action must not have been called
    assert mock_provider.call_counts["custom_validate_action"] == 0


@pytest.mark.asyncio
async def test_unexpected_input_field_name_does_not_leak_sensitive_key(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that unexpected input field names containing sensitive keys are suppressed."""
    sensitive_header_key = "MOCK_SENSITIVE_HEADER_KEY_67890"
    _, handler = get_mcp_tools(
        agent_kit, allowed_actions=["MockActionProvider_strict_extra_action"]
    )

    result = await handler(
        "MockActionProvider_strict_extra_action",
        {"count": 5, sensitive_header_key: "some_value"},
    )

    assert isinstance(result, CallToolResult)
    assert result.isError is True
    assert isinstance(result.content[0], TextContent)

    # Must NOT disclose the dynamic sensitive field name
    assert sensitive_header_key not in result.content[0].text

    # Must return generic message
    expected_msg = (
        "Invalid arguments for tool 'MockActionProvider_strict_extra_action'. "
        "Check the tool's input schema and required fields."
    )
    assert result.content[0].text == expected_msg
    # Underlying action must not have been called
    assert mock_provider.call_counts["strict_extra_action"] == 0


@pytest.mark.asyncio
async def test_unexpected_exceptions_do_not_disclose_token_or_path(
    agent_kit: AgentKit,
) -> None:
    """Verify that exceptions containing URL tokens and paths return generic error text."""
    _, handler = get_mcp_tools(
        agent_kit, allowed_actions=["MockActionProvider_leak_sensitive_action"]
    )

    result = await handler("MockActionProvider_leak_sensitive_action", {})

    assert isinstance(result, CallToolResult)
    assert result.isError is True
    assert isinstance(result.content[0], TextContent)

    # Must NOT disclose secret auth token or filesystem path
    assert "SECRET_AUTH_TOKEN_98765" not in result.content[0].text
    assert "/Users/admin" not in result.content[0].text
    assert "wallet_secret.json" not in result.content[0].text

    # Must return a safe generic message naming the action and exception type
    expected_msg = (
        "Error executing tool 'MockActionProvider_leak_sensitive_action': "
        "RuntimeError occurred during action execution."
    )
    assert result.content[0].text == expected_msg


@pytest.mark.asyncio
async def test_handler_does_not_log_sensitive_arguments_or_raw_exception(
    agent_kit: AgentKit, caplog: pytest.LogCaptureFixture
) -> None:
    """Verify internal logging captures only safe contextual data without sensitive details."""
    _, handler = get_mcp_tools(
        agent_kit, allowed_actions=["MockActionProvider_leak_sensitive_action"]
    )

    with caplog.at_level(logging.WARNING, logger="coinbase_agentkit_model_context_protocol"):
        await handler("MockActionProvider_leak_sensitive_action", {})

    # Sensitive strings must NOT appear in logs
    assert "SECRET_AUTH_TOKEN_98765" not in caplog.text
    assert "/Users/admin" not in caplog.text

    # Safe log message must be recorded
    assert (
        "Tool execution failed for 'MockActionProvider_leak_sensitive_action' with exception type 'RuntimeError'"
        in caplog.text
    )
