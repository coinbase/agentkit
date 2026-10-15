"""Tests for CrewAI tools conversion."""

from crewai.tools import BaseTool

from coinbase_agentkit import AgentKit
from coinbase_agentkit_crewai import AgentKitCrewAITool, get_crewai_tools


def test_basic_tool_conversion(agent_kit: AgentKit) -> None:
    """Test that actions are converted to CrewAI tools."""
    tools = get_crewai_tools(agent_kit)

    assert len(tools) == 3
    assert all(isinstance(tool, BaseTool) for tool in tools)
    assert all(isinstance(tool, AgentKitCrewAITool) for tool in tools)


def test_tool_metadata_and_schema(agent_kit: AgentKit) -> None:
    """Test that tool metadata and schemas are preserved."""
    tools = get_crewai_tools(agent_kit)
    add_tool = next(tool for tool in tools if tool.name == "MockActionProvider_add_numbers")

    assert "Tool Description: Add two integers together" in add_tool.description
    assert add_tool.args_schema is not None

    schema = add_tool.args_schema.model_json_schema()
    assert schema["properties"]["a"]["type"] == "integer"
    assert schema["properties"]["b"]["type"] == "integer"
    assert schema["required"] == ["a", "b"]


def test_optional_schema_defaults_are_preserved(agent_kit: AgentKit) -> None:
    """Test that optional schema defaults remain available to CrewAI."""
    tools = get_crewai_tools(agent_kit)
    message_tool = next(tool for tool in tools if tool.name == "MockActionProvider_create_message")

    result = message_tool.run(content="hello")

    assert result == "Message [NORMAL]: hello"


def test_no_args_action_uses_empty_schema(agent_kit: AgentKit) -> None:
    """Test that no-argument actions are exposed with an empty schema."""
    tools = get_crewai_tools(agent_kit)
    wallet_tool = next(tool for tool in tools if tool.name == "MockActionProvider_get_wallet_info")

    assert wallet_tool.args_schema is not None
    assert wallet_tool.args_schema.model_json_schema()["properties"] == {}

    result = wallet_tool.run()

    assert "Wallet: test_wallet" in result
    assert "Address: 0x1234567890abcdef1234567890abcdef12345678" in result


def test_tool_invocation(agent_kit: AgentKit) -> None:
    """Test that CrewAI tools invoke AgentKit actions."""
    tools = get_crewai_tools(agent_kit)
    add_tool = next(tool for tool in tools if tool.name == "MockActionProvider_add_numbers")

    result = add_tool.run(a=5, b=3)

    assert result == "Addition result: 5 + 3 = 8"
