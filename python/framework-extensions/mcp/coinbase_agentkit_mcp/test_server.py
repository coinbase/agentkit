"""Tests for AgentKit MCP Server."""

import pytest
from coinbase_agentkit_mcp.server import AgentKitMCPServer


def test_server_initialization():
    """Test that server initializes correctly."""
    server = AgentKitMCPServer()
    assert server.server.name == "agentkit-mcp"
    assert server.agent_kit is None


def test_get_tools():
    """Test that tools are defined correctly."""
    server = AgentKitMCPServer()
    tools = server._get_tools()
    
    assert len(tools) > 0
    
    # Check for required tools
    tool_names = [tool.name for tool in tools]
    assert "get_wallet_address" in tool_names
    assert "get_balance" in tool_names