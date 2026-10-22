"""Model Context Protocol (MCP) server integration for AgentKit."""

import logging
from collections.abc import Sequence
from typing import Any

import anyio
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server
from mcp.types import CallToolResult, Tool

from coinbase_agentkit import AgentKit

from .mcp_tools import get_mcp_tools

logger = logging.getLogger("coinbase_agentkit_model_context_protocol")


def create_mcp_server(
    agent_kit: AgentKit,
    *,
    allowed_actions: Sequence[str],
    name: str = "coinbase-agentkit",
    version: str = "0.1.0",
) -> Server:
    """Create a configured Model Context Protocol (MCP) Server instance.

    This factory initializes an MCP low-level Server, delegates tool conversion and execution
    to `get_mcp_tools`, and registers the standard `list_tools` and `call_tool` handlers.

    Security & Error Handling Semantics:
        - Only actions in `allowed_actions` are registered and advertised via `tools/list`.
        - Tool execution is delegated to `mcp_tools.tool_handler` with `validate_input=False`
          to ensure our sanitized Pydantic validation governs client-facing error responses.
        - When an unknown or non-allowlisted tool name is invoked, `tool_handler` internally
          raises `McpError(ErrorData(code=INVALID_PARAMS, message="Tool '<name>' not found."))`.
          The low-level MCP SDK `Server.call_tool` wrapper catches this exception and normalizes
          it into a client-facing `CallToolResult(isError=True)` response rather than raising a
          JSON-RPC protocol error, ensuring compliant and informative client communication.

    Args:
        agent_kit: An initialized AgentKit instance.
        allowed_actions: Mandatory sequence of action names permitted for MCP exposure.
        name: Name identifier for the MCP server. Defaults to "coinbase-agentkit".
        version: Version string for the MCP server. Defaults to "0.1.0".

    Returns:
        Server: Configured MCP low-level Server instance ready for transport execution.

    Raises:
        ValueError: If duplicate action names exist in AgentKit, if duplicate entries
            exist in `allowed_actions`, or if an allowlisted action is not available.

    """
    mcp_tools = get_mcp_tools(agent_kit, allowed_actions=allowed_actions)
    server = Server(name=name, version=version)

    @server.list_tools()  # type: ignore[no-untyped-call,untyped-decorator]
    async def list_tools() -> list[Tool]:
        return mcp_tools.tools

    # Set validate_input=False so that tool_handler's sanitized validation is used
    # rather than the SDK's secondary jsonschema validation. The Server.call_tool wrapper
    # catches internal McpError or action execution exceptions and normalizes them into
    # a CallToolResult(isError=True) client response.
    @server.call_tool(validate_input=False)  # type: ignore[untyped-decorator]
    async def call_tool(name: str, arguments: dict[str, Any] | None = None) -> CallToolResult:
        return await mcp_tools.tool_handler(name, arguments)

    return server


async def run_stdio_server(
    server: Server,
    *,
    raise_exceptions: bool = False,
) -> None:
    """Run an MCP Server over local standard input/output (stdio) streams.

    This function enters the standard I/O transport context and runs the configured
    Server using stdin and stdout. It is strictly local: no network sockets, HTTP
    listeners, or remote SSE endpoints are opened.

    Args:
        server: An initialized and configured MCP low-level Server instance.
        raise_exceptions: Whether to raise exceptions instead of returning them
            as messages to the client. Defaults to False.

    Raises:
        BaseException: Propagates clean shutdown signals (CancelledError, KeyboardInterrupt)
            and unexpected runtime errors without leaking sensitive payload data.

    """
    logger.info("Starting local MCP stdio server '%s' (version %s)", server.name, server.version)
    init_options = server.create_initialization_options()

    try:
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                init_options,
                raise_exceptions=raise_exceptions,
            )
    except (KeyboardInterrupt, anyio.get_cancelled_exc_class()):
        logger.info("Local MCP stdio server shut down cleanly")
        raise
    except Exception as e:
        logger.error("Local MCP stdio server encountered an error: %s", type(e).__name__)
        raise
