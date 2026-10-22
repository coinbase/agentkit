"""End-to-end integration tests using official MCP ClientSession over in-memory streams and stdio."""

import os
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio
import pytest
from mcp import ClientSession
from mcp.server.lowlevel import Server
from mcp.shared.message import SessionMessage
from mcp.types import TextContent

from coinbase_agentkit import AgentKit
from coinbase_agentkit_model_context_protocol import create_mcp_server
from tests.conftest import MockActionProvider


@asynccontextmanager
async def _run_in_memory_client_server(server: Server) -> AsyncIterator[ClientSession]:
    """Establish in-memory bidirectional streams connecting Server and ClientSession."""
    server_to_client_send, server_to_client_receive = anyio.create_memory_object_stream[
        SessionMessage | Exception
    ](0)
    client_to_server_send, client_to_server_receive = anyio.create_memory_object_stream[
        SessionMessage
    ](0)

    init_options = server.create_initialization_options()

    async with anyio.create_task_group() as tg:
        tg.start_soon(
            server.run,
            client_to_server_receive,
            server_to_client_send,
            init_options,
            False,
        )

        async with ClientSession(server_to_client_receive, client_to_server_send) as client:
            await client.initialize()
            yield client

        tg.cancel_scope.cancel()


@pytest.mark.asyncio
async def test_client_session_handshake_and_allowlisted_tools(
    agent_kit: AgentKit, all_action_names: list[str]
) -> None:
    """Verify official ClientSession handshake and tool listing returns only approved actions."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    async with _run_in_memory_client_server(server) as client:
        tools_result = await client.list_tools()
        tool_names = [t.name for t in tools_result.tools]

        assert tool_names == ["MockActionProvider_add_numbers"]
        assert len(tools_result.tools) == 1
        tool = tools_result.tools[0]
        assert tool.description == "Add two numbers together"
        assert "a" in tool.inputSchema["properties"]
        assert "b" in tool.inputSchema["properties"]

        # Ensure no other provider actions leaked into client's tool catalogue
        for other_name in all_action_names:
            if other_name != "MockActionProvider_add_numbers":
                assert other_name not in tool_names


@pytest.mark.asyncio
async def test_client_session_call_approved_action(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify ClientSession can execute an allowlisted action and receive results."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    async with _run_in_memory_client_server(server) as client:
        res = await client.call_tool("MockActionProvider_add_numbers", {"a": 42, "b": 58})

        assert res.isError is False
        assert len(res.content) == 1
        assert isinstance(res.content[0], TextContent)
        assert res.content[0].text == "Result: 100"
        assert mock_provider.call_counts["add_numbers"] == 1


@pytest.mark.asyncio
async def test_client_session_call_excluded_action_rejected(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify ClientSession calling an excluded action returns an error and never invokes it."""
    # Exclude MockActionProvider_list_items from the allowlist
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    async with _run_in_memory_client_server(server) as client:
        res = await client.call_tool("MockActionProvider_list_items", {})

        assert res.isError is True
        assert len(res.content) == 1
        assert isinstance(res.content[0], TextContent)
        assert "Tool 'MockActionProvider_list_items' not found." in res.content[0].text
        # The underlying action must NEVER be executed
        assert mock_provider.call_counts["list_items"] == 0


@pytest.mark.asyncio
async def test_client_session_call_unknown_action_rejected(agent_kit: AgentKit) -> None:
    """Verify ClientSession calling a non-existent tool name returns not found error."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    async with _run_in_memory_client_server(server) as client:
        res = await client.call_tool("completely_unknown_action", {})

        assert res.isError is True
        assert len(res.content) == 1
        assert isinstance(res.content[0], TextContent)
        assert "Tool 'completely_unknown_action' not found." in res.content[0].text


@pytest.mark.asyncio
async def test_client_session_validation_failure_sanitized(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify ClientSession receiving input validation error gets sanitized generic response."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_add_numbers"],
    )

    async with _run_in_memory_client_server(server) as client:
        res = await client.call_tool("MockActionProvider_add_numbers", {"a": "invalid_integer"})

        assert res.isError is True
        assert len(res.content) == 1
        assert isinstance(res.content[0], TextContent)
        assert (
            res.content[0].text
            == "Invalid arguments for tool 'MockActionProvider_add_numbers'. Check the tool's input schema and required fields."
        )
        assert mock_provider.call_counts["add_numbers"] == 0


@pytest.mark.asyncio
async def test_client_session_runtime_error_sanitized(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify ClientSession receiving runtime exception gets generic sanitized response."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_failing_action"],
    )

    async with _run_in_memory_client_server(server) as client:
        res = await client.call_tool("MockActionProvider_failing_action", {})

        assert res.isError is True
        assert len(res.content) == 1
        assert isinstance(res.content[0], TextContent)
        assert (
            res.content[0].text
            == "Error executing tool 'MockActionProvider_failing_action': RuntimeError occurred during action execution."
        )
        assert mock_provider.call_counts["failing_action"] == 1


@pytest.mark.asyncio
async def test_client_session_sensitive_leak_suppressed(
    agent_kit: AgentKit, mock_provider: MockActionProvider
) -> None:
    """Verify ClientSession receiving exception containing tokens and paths suppresses them."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["MockActionProvider_leak_sensitive_action"],
    )

    async with _run_in_memory_client_server(server) as client:
        res = await client.call_tool("MockActionProvider_leak_sensitive_action", {})

        assert res.isError is True
        assert len(res.content) == 1
        assert isinstance(res.content[0], TextContent)
        error_text = res.content[0].text
        assert "SECRET_AUTH_TOKEN" not in error_text
        assert "/Users/admin/.credentials" not in error_text
        assert "https://internal.node.io" not in error_text
        assert (
            error_text
            == "Error executing tool 'MockActionProvider_leak_sensitive_action': RuntimeError occurred during action execution."
        )
        assert mock_provider.call_counts["leak_sensitive_action"] == 1


@pytest.mark.asyncio
async def test_client_session_empty_allowlist_exposes_zero_tools(agent_kit: AgentKit) -> None:
    """Verify ClientSession with empty allowlist discovers zero tools."""
    server = create_mcp_server(
        agent_kit,
        allowed_actions=[],
    )

    async with _run_in_memory_client_server(server) as client:
        tools_result = await client.list_tools()
        assert len(tools_result.tools) == 0


_SUBPROCESS_SERVER_SCRIPT = r"""
import builtins
import sys

# Route any print output and standard logging to stderr to strictly protect stdout for MCP JSON-RPC protocol
builtins.print = lambda *a, **k: sys.stderr.write(" ".join(map(str, a)) + "\n")

import logging

logging.basicConfig(stream=sys.stderr, level=logging.INFO)

import socket

def _forbid_network(*args, **kwargs):
    raise RuntimeError("Unintended network listener/socket binding detected")

socket.socket.bind = _forbid_network
socket.socket.listen = _forbid_network

# Suppress external telemetry/analytics network calls
import coinbase_agentkit.analytics

coinbase_agentkit.analytics.track_init = lambda *a, **k: None
coinbase_agentkit.analytics.track_action = lambda *a, **k: None

import asyncio
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from coinbase_agentkit import ActionProvider, AgentKit, AgentKitConfig
from coinbase_agentkit.action_providers.action_decorator import create_action
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.wallet_provider import WalletProvider
from coinbase_agentkit_model_context_protocol import create_mcp_server, run_stdio_server


class SyntheticWallet(WalletProvider):
    def get_address(self) -> str:
        return "0x1111111111111111111111111111111111111111"

    def get_network(self) -> Network:
        return Network(chain_id="8453", protocol_family="evm", network_id="base-mainnet")

    def get_balance(self) -> Decimal:
        return Decimal("10.0")

    def sign_message(self, message: str) -> str:
        return f"signed_{message}"

    def get_name(self) -> str:
        return "synthetic_wallet"

    def native_transfer(self, to: str, value: Decimal) -> str:
        return f"tx_{to}_{value}"


class MathArgs(BaseModel):
    a: int = Field(..., description="First integer")
    b: int = Field(..., description="Second integer")


class SyntheticActionProvider(ActionProvider):
    def __init__(self) -> None:
        super().__init__("synthetic_provider", [])

    def supports_network(self, network: Network) -> bool:
        return True

    @create_action(
        name="add_numbers",
        description="Add two synthetic numbers together",
        schema=MathArgs,
    )
    def add_numbers(self, wallet_provider: Any, args: dict[str, Any]) -> str:
        return f"Sum: {args['a'] + args['b']}"

    @create_action(
        name="excluded_action",
        description="Synthetic action that should remain excluded",
        schema=None,
    )
    def excluded_action(self, wallet_provider: Any, args: dict[str, Any]) -> str:
        return "unreachable"


async def main() -> None:
    agent_kit = AgentKit(
        AgentKitConfig(
            wallet_provider=SyntheticWallet(),
            action_providers=[SyntheticActionProvider()],
        )
    )
    server = create_mcp_server(
        agent_kit,
        allowed_actions=["SyntheticActionProvider_add_numbers"],
        name="subprocess-stdio-smoke-server",
        version="0.1.0",
    )
    await run_stdio_server(server)


if __name__ == "__main__":
    asyncio.run(main())
"""


@pytest.mark.asyncio
async def test_subprocess_stdio_runner_end_to_end() -> None:
    """Verify local stdio transport end-to-end via an actual child process and official client."""
    from mcp.client.stdio import StdioServerParameters, stdio_client

    # Minimal explicit environment: avoid inheriting credentials, API keys, or parent secrets
    minimal_env: dict[str, str] = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONUNBUFFERED": "1",
    }
    if "SYSTEMROOT" in os.environ:
        minimal_env["SYSTEMROOT"] = os.environ["SYSTEMROOT"]

    server_params = StdioServerParameters(
        command=sys.executable,
        args=["-c", _SUBPROCESS_SERVER_SCRIPT],
        env=minimal_env,
    )

    async with (
        stdio_client(server_params) as (read_stream, write_stream),
        ClientSession(read_stream, write_stream) as session,
    ):
        # 1. Successful MCP initialization
        init_res = await session.initialize()
        assert init_res.serverInfo.name == "subprocess-stdio-smoke-server"
        assert init_res.serverInfo.version == "0.1.0"

        # 2. Tool discovery with allowlist enforced
        tools_result = await session.list_tools()
        tool_names = [t.name for t in tools_result.tools]
        assert tool_names == ["SyntheticActionProvider_add_numbers"]
        assert len(tools_result.tools) == 1

        # 3. Successful invocation of approved synthetic action
        result = await session.call_tool(
            "SyntheticActionProvider_add_numbers",
            {"a": 19, "b": 23},
        )
        assert result.isError is False
        assert len(result.content) == 1
        assert isinstance(result.content[0], TextContent)
        assert result.content[0].text == "Sum: 42"

        # 4. Rejection of excluded action
        excluded_result = await session.call_tool(
            "SyntheticActionProvider_excluded_action",
            {},
        )
        assert excluded_result.isError is True
        assert len(excluded_result.content) == 1
        assert isinstance(excluded_result.content[0], TextContent)
        assert (
            "Tool 'SyntheticActionProvider_excluded_action' not found."
            in excluded_result.content[0].text
        )
