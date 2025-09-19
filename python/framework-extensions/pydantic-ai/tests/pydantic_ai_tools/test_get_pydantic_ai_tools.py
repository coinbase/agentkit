"""Tests for PydanticAI tools conversion."""

import os
from unittest.mock import patch

import pytest
from dotenv import load_dotenv
from pydantic_ai import Agent, Tool

from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit_pydantic_ai.pydantic_ai_tools import (
    _get_action_annotations,
    get_pydantic_ai_tools,
)
from tests.pydantic_ai_tools.conftest import MockWalletProvider

"""Test action annotation extraction."""


def test_get_action_annotations_with_schema(agent_kit: AgentKit) -> None:
    """Test extracting annotations from an action with schema."""
    actions = agent_kit.get_actions()
    add_action = next(a for a in actions if "add_numbers" in a.name)

    annotations = _get_action_annotations(add_action)

    assert "a" in annotations
    assert "b" in annotations
    assert "return" in annotations
    assert annotations["return"] is str


def test_get_action_annotations_without_schema(agent_kit: AgentKit) -> None:
    """Test extracting annotations from an action without schema."""
    actions = agent_kit.get_actions()
    wallet_info_action = next(a for a in actions if "get_wallet_info" in a.name)

    annotations = _get_action_annotations(wallet_info_action)

    # Should return empty dict for actions without schema
    assert annotations == {}


def test_get_action_annotations_exception_handling(agent_kit: AgentKit) -> None:
    """Test that annotation extraction handles exceptions gracefully."""
    actions = agent_kit.get_actions()
    action = actions[0]

    # Mock the action to raise an exception during processing
    with patch.object(action, "args_schema") as mock_schema:
        # Set up the mock to raise an exception when model_fields.items() is called
        mock_schema.model_fields.items.side_effect = Exception("Test exception")

        annotations = _get_action_annotations(action)
        assert annotations == {}


"""Test basic tool conversion functionality."""


@pytest.mark.asyncio
async def test_basic_tool_conversion(agent_kit: AgentKit) -> None:
    """Test that actions are properly converted to PydanticAI Tools."""
    tools = get_pydantic_ai_tools(agent_kit)

    assert len(tools) == 5  # Expected number of actions from MockActionProvider
    assert all(isinstance(tool, Tool) for tool in tools)


@pytest.mark.asyncio
async def test_minimal_conversion(minimal_agent_kit: AgentKit) -> None:
    """Test conversion with minimal agent kit."""
    tools = get_pydantic_ai_tools(minimal_agent_kit)

    assert len(tools) == 1
    assert isinstance(tools[0], Tool)


@pytest.mark.asyncio
async def test_empty_agent_kit() -> None:
    """Test conversion with empty action providers (but AgentKit includes default wallet actions)."""
    empty_agent_kit = AgentKit(
        AgentKitConfig(
            wallet_provider=MockWalletProvider(),
            action_providers=[],
        )
    )

    tools = get_pydantic_ai_tools(empty_agent_kit)
    # AgentKit automatically includes default wallet actions even with empty action_providers
    assert len(tools) == 3  # get_balance, get_wallet_details, native_transfer
    assert isinstance(tools, list)

    # Verify the tools are wallet-related
    tool_names = [tool.name for tool in tools]
    assert any("get_balance" in name for name in tool_names)
    assert any("get_wallet_details" in name for name in tool_names)
    assert any("native_transfer" in name for name in tool_names)


"""Test that converted tools conform to PydanticAI Tool interface."""


@pytest.mark.asyncio
async def test_tool_interface_conformance(agent_kit: AgentKit) -> None:
    """Test that converted tools conform to the PydanticAI Tool interface."""
    tools = get_pydantic_ai_tools(agent_kit)
    add_tool = next(t for t in tools if "add_numbers" in t.name)

    # Check required Tool attributes
    assert hasattr(add_tool, "name")
    assert hasattr(add_tool, "description")
    assert hasattr(add_tool, "function")
    assert hasattr(add_tool, "function_schema")

    # Check types
    assert isinstance(add_tool.name, str)
    assert isinstance(add_tool.description, str)
    assert callable(add_tool.function)


@pytest.mark.asyncio
async def test_tool_schema_structure(agent_kit: AgentKit) -> None:
    """Test that tool schemas are correctly structured."""
    tools = get_pydantic_ai_tools(agent_kit)
    add_tool = next(t for t in tools if "add_numbers" in t.name)

    # Check that schema exists and has expected structure
    schema = add_tool.function_schema.json_schema
    assert isinstance(schema, dict)
    assert "type" in schema
    assert "properties" in schema

    # Check specific properties for add_numbers action
    properties = schema["properties"]
    assert "a" in properties
    assert "b" in properties
    assert properties["a"]["type"] == "integer"
    assert properties["b"]["type"] == "integer"


@pytest.mark.asyncio
async def test_all_tools_have_valid_schemas(agent_kit: AgentKit) -> None:
    """Test that all converted tools have valid schemas."""
    tools = get_pydantic_ai_tools(agent_kit)

    for tool in tools:
        # All tools should have names and descriptions
        assert tool.name
        assert tool.description

        # Tools with schemas should have properly structured JSON schemas
        if hasattr(tool.function_schema, "json_schema") and tool.function_schema.json_schema:
            schema = tool.function_schema.json_schema
            assert isinstance(schema, dict)


"""Test that tool metadata is correctly preserved."""


@pytest.mark.asyncio
async def test_tool_metadata_preservation(agent_kit: AgentKit) -> None:
    """Test that tool metadata is correctly preserved from AgentKit actions."""
    tools = get_pydantic_ai_tools(agent_kit)

    # Find specific tools and verify their metadata
    add_tool = next(t for t in tools if "add_numbers" in t.name)
    subtract_tool = next(t for t in tools if "subtract_numbers" in t.name)
    multiply_tool = next(t for t in tools if "multiply_floats" in t.name)

    # Check names contain provider prefix
    assert "MockActionProvider_add_numbers" in add_tool.name
    assert "MockActionProvider_subtract_numbers" in subtract_tool.name
    assert "MockActionProvider_multiply_floats" in multiply_tool.name

    # Check descriptions are preserved
    assert add_tool.description == "Add two integers together"
    assert subtract_tool.description == "Subtract second number from first number"
    assert multiply_tool.description == "Multiply two floating point numbers"


@pytest.mark.asyncio
async def test_tool_name_uniqueness(agent_kit: AgentKit) -> None:
    """Test that all tool names are unique."""
    tools = get_pydantic_ai_tools(agent_kit)
    tool_names = [tool.name for tool in tools]

    assert len(tool_names) == len(set(tool_names)), "Tool names should be unique"


@pytest.mark.asyncio
async def test_tool_descriptions_not_empty(agent_kit: AgentKit) -> None:
    """Test that all tools have non-empty descriptions."""
    tools = get_pydantic_ai_tools(agent_kit)

    for tool in tools:
        assert tool.description.strip(), f"Tool {tool.name} should have a non-empty description"


"""Test tool invocation and execution."""


@pytest.mark.asyncio
async def test_successful_tool_invocation(agent_kit: AgentKit) -> None:
    """Test that tools can be successfully invoked."""
    tools = get_pydantic_ai_tools(agent_kit)
    add_tool = next(t for t in tools if "add_numbers" in t.name)

    # Test tool invocation
    result = add_tool.function(a=5, b=3)
    assert isinstance(result, str)
    assert result == "Addition result: 5 + 3 = 8"


@pytest.mark.asyncio
async def test_multiple_tool_invocations(agent_kit: AgentKit) -> None:
    """Test multiple tool invocations with different arguments."""
    tools = get_pydantic_ai_tools(agent_kit)
    add_tool = next(t for t in tools if "add_numbers" in t.name)
    subtract_tool = next(t for t in tools if "subtract_numbers" in t.name)

    # Test add tool
    add_result = add_tool.function(a=10, b=7)
    assert add_result == "Addition result: 10 + 7 = 17"

    # Test subtract tool
    subtract_result = subtract_tool.function(a=15, b=6)
    assert subtract_result == "Subtraction result: 15 - 6 = 9"


@pytest.mark.asyncio
async def test_float_tool_invocation(agent_kit: AgentKit) -> None:
    """Test tool invocation with float arguments."""
    tools = get_pydantic_ai_tools(agent_kit)
    multiply_tool = next(t for t in tools if "multiply_floats" in t.name)

    result = multiply_tool.function(x=2.5, y=4.0)
    assert result == "Multiplication result: 2.5 * 4.0 = 10.0"


@pytest.mark.asyncio
async def test_optional_parameter_tool_invocation(agent_kit: AgentKit) -> None:
    """Test tool invocation with optional parameters."""
    tools = get_pydantic_ai_tools(agent_kit)
    message_tool = next(t for t in tools if "create_message" in t.name)

    # Test with default priority
    result1 = message_tool.function(content="Hello world")
    assert result1 == "Message [NORMAL]: Hello world"

    # Test with custom priority
    result2 = message_tool.function(content="Urgent message", priority="high")
    assert result2 == "Message [HIGH]: Urgent message"


@pytest.mark.asyncio
async def test_no_args_tool_invocation(agent_kit: AgentKit) -> None:
    """Test tool invocation for actions with no arguments."""
    tools = get_pydantic_ai_tools(agent_kit)
    wallet_tool = next(t for t in tools if "get_wallet_info" in t.name)

    result = wallet_tool.function()
    assert "Wallet: test_wallet" in result
    assert "Address: 0x1234567890abcdef1234567890abcdef12345678" in result
    assert "Balance: 1.5" in result


"""Test tool return type consistency."""


@pytest.mark.asyncio
async def test_string_conversion_of_complex_results(agent_kit: AgentKit) -> None:
    """Test that complex return values are properly converted to strings."""
    # This test ensures that even if actions return complex objects,
    # they are converted to strings by the tool wrapper
    tools = get_pydantic_ai_tools(agent_kit)

    for tool in tools:
        # Get the function annotations to understand expected parameters
        func = tool.function
        if hasattr(func, "__annotations__"):
            annotations = func.__annotations__
            # Build arguments based on the schema
            if "a" in annotations and "b" in annotations:
                result = func(a=1, b=2)
            elif "x" in annotations and "y" in annotations:
                result = func(x=1.0, y=2.0)
            elif "content" in annotations:
                result = func(content="test")
            else:
                result = func()

            assert isinstance(result, str), f"Tool {tool.name} should return a string"


"""Test integration with PydanticAI framework."""


@pytest.mark.asyncio
async def test_tool_compatibility_with_pydantic_ai(agent_kit: AgentKit) -> None:
    """Test that tools are compatible with PydanticAI Agent."""
    tools = get_pydantic_ai_tools(agent_kit)

    # Create a PydanticAI agent with our tools
    # Note: This test verifies compatibility but doesn't run the agent
    # to avoid requiring API keys
    try:
        agent = Agent(
            model="test",  # Mock model name
            tools=tools,
            system_prompt="You are a test agent with AgentKit tools.",
        )

        # Verify the agent was created successfully
        assert agent is not None
        assert len(agent._function_tools) == len(tools)

    except Exception as e:
        pytest.fail(f"Failed to create PydanticAI Agent with AgentKit tools: {e}")


@pytest.mark.asyncio
async def test_tool_schema_compatibility(agent_kit: AgentKit) -> None:
    """Test that tool schemas are compatible with PydanticAI expectations."""
    tools = get_pydantic_ai_tools(agent_kit)

    for tool in tools:
        # Verify tool has required PydanticAI attributes
        assert hasattr(tool, "name")
        assert hasattr(tool, "description")
        assert hasattr(tool, "function")

        # Verify schema structure if present
        if hasattr(tool.function_schema, "json_schema") and tool.function_schema.json_schema:
            schema = tool.function_schema.json_schema
            assert isinstance(schema, dict)

            # Basic JSON schema validation
            if "properties" in schema:
                assert isinstance(schema["properties"], dict)
            if "required" in schema:
                assert isinstance(schema["required"], list)


@pytest.mark.asyncio
async def test_agent_using_tools(agent_kit: AgentKit) -> None:
    """Test that an agent can successfully use the converted tools."""
    load_dotenv()

    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY is not set")

    tools = get_pydantic_ai_tools(agent_kit)

    agent = Agent(
        model="gpt-4o-mini",
        instructions="You are a helpful math agent. When asked to perform calculations, use the appropriate tool and include the result in your response.",
        tools=tools,
    )

    prompt = """Please help me with two calculations:
    1. What is 15 plus 7?
    2. What is 20 minus 8?"""

    result = await agent.run(prompt)
    response = result.output

    # Check that both calculations were performed and results are in the response
    assert "22" in response  # 15 + 7 = 22
    assert "12" in response  # 20 - 8 = 12
