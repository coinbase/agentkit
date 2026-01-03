"""Tests for OpenAI Agents SDK tools conversion."""

import json
import os

import pytest
from agents import Agent, FunctionTool
from agents.run import Runner
from agents.run_context import RunContextWrapper
from dotenv import load_dotenv

from coinbase_agentkit_openai_agents_sdk.openai_agents_sdk_tools import get_openai_agents_sdk_tools

# Load environment variables from .env file
load_dotenv()


@pytest.mark.asyncio
async def test_basic_tool_conversion(agent_kit):
    """Test that actions are properly converted to FunctionTools."""
    tools = get_openai_agents_sdk_tools(agent_kit)
    assert len(tools) == 2
    assert all(isinstance(tool, FunctionTool) for tool in tools)


@pytest.mark.asyncio
async def test_tool_interface_conformance(agent_kit):
    """Test that converted tools conform to the FunctionTool interface."""
    tools = get_openai_agents_sdk_tools(agent_kit)
    add_tool = next(t for t in tools if t.name == "MockActionProvider_add_numbers")
    subtract_tool = next(t for t in tools if t.name == "MockActionProvider_subtract_numbers")

    for tool in [add_tool, subtract_tool]:
        # Required attributes
        assert isinstance(tool.name, str)
        assert isinstance(tool.description, str)
        assert isinstance(tool.params_json_schema, dict)
        assert callable(tool.on_invoke_tool)
        assert isinstance(tool.strict_json_schema, bool)

        # Schema structure
        schema = tool.params_json_schema
        assert "type" in schema
        assert "properties" in schema
        assert all(isinstance(prop, str) for prop in schema["properties"])


@pytest.mark.asyncio
async def test_tool_schema_validation(agent_kit):
    """Test that tool schemas are correctly structured."""
    tools = get_openai_agents_sdk_tools(agent_kit)
    add_tool = next(t for t in tools if t.name == "MockActionProvider_add_numbers")

    add_schema = add_tool.params_json_schema
    assert add_schema["properties"]["a"]["type"] == "integer"
    assert add_schema["properties"]["b"]["type"] == "integer"


@pytest.mark.asyncio
async def test_tool_metadata(agent_kit):
    """Test that tool metadata is correctly preserved."""
    tools = get_openai_agents_sdk_tools(agent_kit)
    add_tool = next(t for t in tools if t.name == "MockActionProvider_add_numbers")
    subtract_tool = next(t for t in tools if t.name == "MockActionProvider_subtract_numbers")

    assert add_tool.name == "MockActionProvider_add_numbers"
    assert add_tool.description == "Add two numbers together"
    assert subtract_tool.name == "MockActionProvider_subtract_numbers"
    assert subtract_tool.description == "Subtract second number from first number"


@pytest.mark.asyncio
async def test_successful_tool_invocation(agent_kit):
    """Test that tools can be successfully invoked."""
    tools = get_openai_agents_sdk_tools(agent_kit)
    add_tool = next(t for t in tools if t.name == "MockActionProvider_add_numbers")
    subtract_tool = next(t for t in tools if t.name == "MockActionProvider_subtract_numbers")
    ctx = RunContextWrapper(None)

    # Test add tool
    add_result = await add_tool.on_invoke_tool(ctx, json.dumps({"a": 5, "b": 3}))
    assert "The sum of 5 and 3 is 8" in add_result

    # Test subtract tool
    subtract_result = await subtract_tool.on_invoke_tool(ctx, json.dumps({"a": 10, "b": 4}))
    assert "The result of 10 minus 4 is 6" in subtract_result


@pytest.mark.asyncio
async def test_tool_error_handling(agent_kit):
    """Test that tools properly handle various error conditions."""
    tools = get_openai_agents_sdk_tools(agent_kit)
    add_tool = next(t for t in tools if t.name == "MockActionProvider_add_numbers")
    ctx = RunContextWrapper(None)

    # Test empty input
    with pytest.raises(ValueError):
        await add_tool.on_invoke_tool(ctx, "")

    # Test invalid JSON
    with pytest.raises(json.JSONDecodeError):
        await add_tool.on_invoke_tool(ctx, "not json")

    # Test invalid schema
    with pytest.raises(ValueError):
        await add_tool.on_invoke_tool(ctx, json.dumps({"invalid": "args"}))

    # Test type validation
    with pytest.raises(TypeError):
        await add_tool.on_invoke_tool(ctx, json.dumps({"a": "not a number", "b": 3}))


@pytest.mark.asyncio
async def test_agent_using_tools(agent_kit):
    """Test that an agent can successfully use the converted tools."""
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY is not set")

    tools = get_openai_agents_sdk_tools(agent_kit)

    agent = Agent(
        name="Math Agent",
        instructions="You are a helpful math agent. When asked to perform calculations, use the appropriate tool and include the result in your response.",
        tools=tools,
    )

    # Test both addition and subtraction in one conversation
    prompt = """Please help me with two calculations:
    1. What is 15 plus 7?
    2. What is 20 minus 8?"""

    result = await Runner.run(agent, prompt)
    response = result.final_output

    # Check that both calculations were performed and results are in the response
    assert "22" in response  # 15 + 7 = 22
    assert "12" in response  # 20 - 8 = 12
