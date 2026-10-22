"""Integration tests and security assertions for AgentKit MCP server integration."""

import asyncio
import inspect
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from mcp.server.lowlevel import Server
from mcp.server.models import InitializationOptions
from mcp.types import (
    CallToolRequest,
    CallToolRequestParams,
    CallToolResult,
    ListToolsRequest,
    ListToolsResult,
    TextContent,
)

from coinbase_agentkit import AgentKit
from coinbase_agentkit_model_context_protocol import create_mcp_server, run_stdio_server
from tests.conftest import MockActionProvider


def test_create_mcp_server_initialization(agent_kit: AgentKit) -> None:
    """Verify create_mcp_server returns a properly configured low-level Server instance."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )
    assert isinstance(server, Server)
    assert server.name == "coinbase-agentkit"
    assert server.version == "0.1.0"

    # Custom name and version
    custom_server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
        name="custom-agent-server",
        version="1.2.3",
    )
    assert custom_server.name == "custom-agent-server"
    assert custom_server.version == "1.2.3"


def test_create_mcp_server_requires_explicit_allowed_actions() -> None:
    """Verify that allowed_actions is a mandatory, keyword-only parameter with no default."""
    sig = inspect.signature(create_mcp_server)
    param = sig.parameters.get("allowed_actions")
    assert param is not None, "allowed_actions parameter must exist"
    assert param.kind == inspect.Parameter.KEYWORD_ONLY, "allowed_actions must be keyword-only"
    assert param.default == inspect.Parameter.empty, "allowed_actions must not have a default value"


def test_create_mcp_server_invalid_allowlist_raises(agent_kit: AgentKit) -> None:
    """Verify that invalid allowlists raise ValueError at server creation time."""
    # Action not present in AgentKit
    with pytest.raises(ValueError, match="not available in AgentKit"):
        create_mcp_server(
            agent_kit,
            allowed_actions=["non_existent_action"],
        )

    # Duplicate allowlist entries
    with pytest.raises(ValueError, match="Duplicate entry in allowed_actions"):
        create_mcp_server(
            agent_kit,
            allowed_actions=[
                "MockActionProvider_add_numbers",
                "MockActionProvider_add_numbers",
            ],
        )


@pytest.mark.asyncio
async def test_server_list_tools_returns_only_approved_actions(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify that tools/list request returns only explicitly approved actions."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    list_handler = server.request_handlers[ListToolsRequest]
    req = ListToolsRequest(method="tools/list")
    res = await list_handler(req)
    list_result = cast(ListToolsResult, res.root)

    assert len(list_result.tools) == 1
    tool = list_result.tools[0]
    assert tool.name == "MockActionProvider_add_numbers"
    assert tool.description == "Add two numbers together"
    assert "a" in tool.inputSchema["properties"]
    assert "b" in tool.inputSchema["properties"]

    # Verify other provider actions are completely absent
    for other_name in all_action_names:
        if other_name != "MockActionProvider_add_numbers":
            assert not any(t.name == other_name for t in list_result.tools)


@pytest.mark.asyncio
async def test_server_empty_allowlist_exposes_zero_tools(agent_kit: AgentKit) -> None:
    """Verify that an explicitly empty allowlist configures a server with zero exposed tools."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=[],
    )

    list_handler = server.request_handlers[ListToolsRequest]
    req = ListToolsRequest(method="tools/list")
    res = await list_handler(req)
    list_result = cast(ListToolsResult, res.root)

    assert list_result.tools == []


@pytest.mark.asyncio
async def test_server_call_tool_successful_dispatch(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that tools/call executes allowlisted actions and returns CallToolResult."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="MockActionProvider_add_numbers",
            arguments={"a": 12, "b": 18},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is False
    assert len(call_result.content) == 1
    assert isinstance(call_result.content[0], TextContent)
    assert call_result.content[0].text == "Result: 30"
    assert mock_provider.call_counts["add_numbers"] == 1


@pytest.mark.asyncio
async def test_server_call_tool_excluded_action_rejected(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that calling an unapproved action fails and never invokes the action."""
    # Only allow MockActionProvider_add_numbers; exclude MockActionProvider_list_items
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="MockActionProvider_list_items",
            arguments={},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is True
    assert len(call_result.content) == 1
    assert isinstance(call_result.content[0], TextContent)
    assert "Tool 'MockActionProvider_list_items' not found." in call_result.content[0].text
    # The underlying action must NEVER be invoked
    assert mock_provider.call_counts["list_items"] == 0


@pytest.mark.asyncio
async def test_server_call_tool_unknown_action_rejected(agent_kit: AgentKit) -> None:
    """Verify that calling a completely unrecognized tool returns standard MCP not found error."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="completely_unknown_action",
            arguments={},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is True
    assert len(call_result.content) == 1
    assert isinstance(call_result.content[0], TextContent)
    assert "Tool 'completely_unknown_action' not found." in call_result.content[0].text


@pytest.mark.asyncio
async def test_server_call_tool_validation_failure_sanitized(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that validation failures return generic error and do not call action."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="MockActionProvider_add_numbers",
            arguments={"a": "not_an_int"},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is True
    assert isinstance(call_result.content[0], TextContent)
    error_text = call_result.content[0].text
    assert (
        error_text
        == "Invalid arguments for tool 'MockActionProvider_add_numbers'. Check the tool's input schema and required fields."
    )
    assert mock_provider.call_counts["add_numbers"] == 0


@pytest.mark.asyncio
async def test_server_call_tool_action_execution_failure_sanitized(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that action runtime errors are caught and sanitized."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_failing_action"],
    )

    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="MockActionProvider_failing_action",
            arguments={},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is True
    assert isinstance(call_result.content[0], TextContent)
    error_text = call_result.content[0].text
    assert (
        error_text
        == "Error executing tool 'MockActionProvider_failing_action': RuntimeError occurred during action execution."
    )
    assert mock_provider.call_counts["failing_action"] == 1


@pytest.mark.asyncio
async def test_server_call_tool_sensitive_exception_not_disclosed(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that sensitive exception messages, tokens, and paths are redacted."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_leak_sensitive_action"],
    )

    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="MockActionProvider_leak_sensitive_action",
            arguments={},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is True
    assert isinstance(call_result.content[0], TextContent)
    error_text = call_result.content[0].text
    assert "SECRET_AUTH_TOKEN" not in error_text
    assert "/Users/admin/.credentials" not in error_text
    assert "https://internal.node.io" not in error_text
    assert (
        error_text
        == "Error executing tool 'MockActionProvider_leak_sensitive_action': RuntimeError occurred during action execution."
    )
    assert mock_provider.call_counts["leak_sensitive_action"] == 1


@pytest.mark.asyncio
async def test_server_call_tool_custom_validator_secret_not_disclosed(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that custom validation messages containing sensitive data are suppressed."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_custom_validate_action"],
    )

    sensitive_token = "MOCK_SECRET_AUTH_KEY_XYZ"
    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="MockActionProvider_custom_validate_action",
            arguments={"token": sensitive_token},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is True
    assert isinstance(call_result.content[0], TextContent)
    error_text = call_result.content[0].text
    assert sensitive_token not in error_text
    assert "MOCK_SECRET" not in error_text
    assert (
        error_text
        == "Invalid arguments for tool 'MockActionProvider_custom_validate_action'. Check the tool's input schema and required fields."
    )
    assert mock_provider.call_counts["custom_validate_action"] == 0


@pytest.mark.asyncio
async def test_server_call_tool_unexpected_field_not_disclosed(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify that unexpected input field names containing sensitive strings are suppressed."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_strict_extra_action"],
    )

    sensitive_key_name = "LEAK_SECRET_PRIVATE_API_KEY"
    call_handler = server.request_handlers[CallToolRequest]
    req = CallToolRequest(
        method="tools/call",
        params=CallToolRequestParams(
            name="MockActionProvider_strict_extra_action",
            arguments={"count": 5, sensitive_key_name: "some_value"},
        ),
    )
    res = await call_handler(req)
    call_result = cast(CallToolResult, res.root)

    assert call_result.isError is True
    assert isinstance(call_result.content[0], TextContent)
    error_text = call_result.content[0].text
    assert sensitive_key_name not in error_text
    assert (
        error_text
        == "Invalid arguments for tool 'MockActionProvider_strict_extra_action'. Check the tool's input schema and required fields."
    )
    assert mock_provider.call_counts["strict_extra_action"] == 0


@asynccontextmanager
async def _mock_stdio_transport(
    read_stream: Any = None, write_stream: Any = None
) -> AsyncIterator[tuple[Any, Any]]:
    """Mock context manager yielding stdio memory streams."""
    yield (
        read_stream if read_stream is not None else MagicMock(),
        write_stream if write_stream is not None else MagicMock(),
    )


@pytest.mark.asyncio
async def test_run_stdio_server_success() -> None:
    """Verify run_stdio_server enters stdio transport and passes streams and options to server.run."""
    server = MagicMock(spec=Server)
    server.name = "test-server"
    server.version = "1.0.0"
    mock_init_options = MagicMock(spec=InitializationOptions)
    server.create_initialization_options = MagicMock(return_value=mock_init_options)
    server.run = AsyncMock()

    mock_read = MagicMock()
    mock_write = MagicMock()

    with patch(
        "coinbase_agentkit_model_context_protocol.server.stdio_server",
        lambda: _mock_stdio_transport(mock_read, mock_write),
    ):
        await run_stdio_server(server)

    server.create_initialization_options.assert_called_once()
    server.run.assert_awaited_once_with(
        mock_read,
        mock_write,
        mock_init_options,
        raise_exceptions=False,
    )


@pytest.mark.asyncio
async def test_run_stdio_server_with_real_server_instance(agent_kit: AgentKit) -> None:
    """Verify run_stdio_server with a real create_mcp_server instance and explicit options."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
        name="agentkit-stdio",
        version="0.5.0",
    )

    mock_read = MagicMock()
    mock_write = MagicMock()

    with (
        patch.object(server, "run", new_callable=AsyncMock) as mock_run,
        patch(
            "coinbase_agentkit_model_context_protocol.server.stdio_server",
            lambda: _mock_stdio_transport(mock_read, mock_write),
        ),
    ):
        await run_stdio_server(server, raise_exceptions=True)

    mock_run.assert_awaited_once()
    args, kwargs = mock_run.call_args
    assert args[0] is mock_read
    assert args[1] is mock_write
    init_opts = args[2]
    assert isinstance(init_opts, InitializationOptions)
    assert init_opts.server_name == "agentkit-stdio"
    assert init_opts.server_version == "0.5.0"
    assert kwargs["raise_exceptions"] is True


@pytest.mark.asyncio
async def test_run_stdio_server_clean_shutdown_cancelled() -> None:
    """Verify asyncio.CancelledError propagates cleanly on task cancellation."""
    server = MagicMock(spec=Server)
    server.name = "test-server"
    server.version = "1.0.0"
    server.create_initialization_options = MagicMock()
    server.run = AsyncMock(side_effect=asyncio.CancelledError())

    with (
        patch(
            "coinbase_agentkit_model_context_protocol.server.stdio_server",
            _mock_stdio_transport,
        ),
        pytest.raises(asyncio.CancelledError),
    ):
        await run_stdio_server(server)


@pytest.mark.asyncio
async def test_run_stdio_server_clean_shutdown_keyboard_interrupt() -> None:
    """Verify KeyboardInterrupt propagates cleanly on SIGINT."""
    server = MagicMock(spec=Server)
    server.name = "test-server"
    server.version = "1.0.0"
    server.create_initialization_options = MagicMock()
    server.run = AsyncMock(side_effect=KeyboardInterrupt())

    with (
        patch(
            "coinbase_agentkit_model_context_protocol.server.stdio_server",
            _mock_stdio_transport,
        ),
        pytest.raises(KeyboardInterrupt),
    ):
        await run_stdio_server(server)


@pytest.mark.asyncio
async def test_run_stdio_server_runtime_error_redacted_logging(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Verify runtime exceptions are re-raised and logged without leaking sensitive data."""
    server = MagicMock(spec=Server)
    server.name = "test-server"
    server.version = "1.0.0"
    server.create_initialization_options = MagicMock()
    sensitive_token = "LEAK_SECRET_RPC_KEY_12345"
    server.run = AsyncMock(side_effect=RuntimeError(f"Connection failed: {sensitive_token}"))

    with (
        patch(
            "coinbase_agentkit_model_context_protocol.server.stdio_server",
            _mock_stdio_transport,
        ),
        caplog.at_level(logging.ERROR),
        pytest.raises(RuntimeError),
    ):
        await run_stdio_server(server)

    # Verify exception type is logged but the sensitive token is never logged
    assert any("RuntimeError" in record.message for record in caplog.records)
    assert not any(sensitive_token in record.message for record in caplog.records)


@pytest.mark.asyncio
async def test_run_stdio_server_strictly_local_no_network_listener() -> None:
    """Verify that run_stdio_server never binds or listens on network sockets."""
    server = MagicMock(spec=Server)
    server.name = "test-server"
    server.version = "1.0.0"
    server.create_initialization_options = MagicMock()
    server.run = AsyncMock()

    with (
        patch("socket.socket.bind") as mock_bind,
        patch("socket.socket.listen") as mock_listen,
        patch(
            "coinbase_agentkit_model_context_protocol.server.stdio_server",
            _mock_stdio_transport,
        ),
    ):
        await run_stdio_server(server)

    mock_bind.assert_not_called()
    mock_listen.assert_not_called()
