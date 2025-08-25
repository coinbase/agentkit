import os

import pytest
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient
from dotenv import load_dotenv
from pydantic import BaseModel

from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit_autogen import AutogenTool, get_autogen_tools
from tests.autogen_tools.conftest import MockWalletProvider

"""Test that actions are properly converted to AutogenTool."""


@pytest.mark.asyncio
async def test_autogen_tool_conversion_with_schema(agent_kit: AgentKit):
    """Test converting an action to an AutogenTool with schema."""
    actions = agent_kit.get_actions()
    action = next(a for a in actions if "add_numbers" in a.name)

    add_tool = AutogenTool.from_action(action)

    # Test that the schema has the correct name and description
    assert add_tool.name == add_tool.schema["name"] == "MockActionProvider_add_numbers"
    assert add_tool.description == add_tool.schema["description"] == "Add two numbers together"

    # Test that the schema has the correct parameters
    assert not add_tool.schema["strict"]
    assert add_tool.schema["parameters"]["required"] == ["a", "b"]

    # Test that the schema has the correct properties
    properties = add_tool.schema["parameters"]["properties"]
    assert "a" in properties
    assert "b" in properties
    assert properties["a"]["type"] == "integer"
    assert properties["b"]["type"] == "integer"


@pytest.mark.asyncio
async def test_autogen_tool_conversion_with_invalid_schema(agent_kit: AgentKit):
    """Test converting an action to an AutogenTool with invalid schema."""
    actions = agent_kit.get_actions()
    action = actions[0]
    action.args_schema = 1  # type: ignore

    with pytest.raises(ValueError) as e:
        _ = AutogenTool.from_action(action)
        assert e.value.args[0] == "args_type must be a subclass of BaseModel"


@pytest.mark.asyncio
async def test_autogen_tool_conversion_without_schema(agent_kit: AgentKit):
    """Test converting an action to an AutogenTool without a schema."""
    actions = agent_kit.get_actions()

    # Get the action has no schema
    action = next(a for a in actions if "get_wallet_info" in a.name)

    wallet_info_tool = AutogenTool.from_action(action)

    schema = wallet_info_tool.schema
    assert schema["parameters"]["properties"] == {}


"""Test that get_autogen_tools works as expected."""


@pytest.mark.asyncio
async def test_basic_get_autogen_tools(agent_kit: AgentKit):
    """Test that get_autogen_tools returns the correct number of AutogenTools."""
    tools = get_autogen_tools(agent_kit)

    assert len(tools) == 3
    assert all(isinstance(tool, AutogenTool) for tool in tools)


@pytest.mark.asyncio
async def test_empty_agent_kit():
    """Test conversion with empty action providers (but AgentKit includes default wallet actions)."""
    empty_agent_kit = AgentKit(
        AgentKitConfig(
            wallet_provider=MockWalletProvider(),
            action_providers=[],
        )
    )

    tools = get_autogen_tools(empty_agent_kit)

    # AgentKit automatically includes default wallet actions even with empty action_providers
    assert len(tools) == 3  # get_balance, get_wallet_details, native_transfer
    assert isinstance(tools, list)

    # Verify the tools are wallet-related
    tool_names = [tool.name for tool in tools]
    assert any("get_balance" in name for name in tool_names)
    assert any("get_wallet_details" in name for name in tool_names)
    assert any("native_transfer" in name for name in tool_names)


@pytest.mark.asyncio
async def test_tool_interface_conformance(agent_kit: AgentKit):
    """Test that converted tools conform to the AutogenTool interface."""
    tools = get_autogen_tools(agent_kit)
    add_tool = next(t for t in tools if "add_numbers" in t.name)

    # Check tool attributes
    assert hasattr(add_tool, "name")
    assert hasattr(add_tool, "description")
    assert hasattr(add_tool, "schema")
    assert hasattr(add_tool, "run")

    # Check types
    assert isinstance(add_tool.name, str)
    assert isinstance(add_tool.description, str)
    assert isinstance(add_tool.schema, dict)
    assert callable(add_tool.run)


@pytest.mark.asyncio
async def test_tool_schema(agent_kit: AgentKit):
    """Test that converted tools have the correct schema."""
    tools = get_autogen_tools(agent_kit)
    add_tool = next(t for t in tools if "add_numbers" in t.name)

    # Test that the schema has the correct name and description
    assert add_tool.name == add_tool.schema["name"] == "MockActionProvider_add_numbers"
    assert add_tool.description == add_tool.schema["description"] == "Add two numbers together"

    # Test that the schema has the correct parameters
    assert not add_tool.schema["strict"]
    assert add_tool.schema["parameters"]["required"] == ["a", "b"]

    # Test that the schema has the correct properties
    properties = add_tool.schema["parameters"]["properties"]
    assert "a" in properties
    assert "b" in properties
    assert properties["a"]["type"] == "integer"
    assert properties["b"]["type"] == "integer"


@pytest.mark.asyncio
async def test_tool_with_no_schema(agent_kit: AgentKit):
    """Test that tools with no schema are handled correctly."""
    tools = get_autogen_tools(agent_kit)

    # tool with no schema
    wallet_info_tool = next(t for t in tools if "get_wallet_info" in t.name)

    schema_model = wallet_info_tool.args_type()
    schema = wallet_info_tool.schema
    assert issubclass(schema_model, BaseModel)
    assert schema_model.__name__ == "EmptyModel"
    assert schema["parameters"]["properties"] == {}


"""Test all tools have valid metadata."""


@pytest.mark.asyncio
async def test_all_tools_have_valid_metadata(agent_kit: AgentKit):
    """Test that all tools have valid metadata."""
    tools = get_autogen_tools(agent_kit)

    add_tool = next(t for t in tools if "add_numbers" in t.name)
    subtract_tool = next(t for t in tools if "subtract_numbers" in t.name)
    wallet_info_tool = next(t for t in tools if "get_wallet_info" in t.name)

    assert add_tool.name == "MockActionProvider_add_numbers"
    assert add_tool.description == "Add two numbers together"

    assert subtract_tool.name == "MockActionProvider_subtract_numbers"
    assert subtract_tool.description == "Subtract second number from first number"

    assert wallet_info_tool.name == "MockActionProvider_get_wallet_info"
    assert wallet_info_tool.description == "Get wallet information"


@pytest.mark.asyncio
async def test_tool_name_uniqueness(agent_kit: AgentKit):
    """Test that all tools have unique names."""
    tools = get_autogen_tools(agent_kit)

    tool_names = [tool.name for tool in tools]
    assert len(tool_names) == len(set(tool_names))


@pytest.mark.asyncio
async def test_all_tools_have_valid_structure(agent_kit: AgentKit):
    """Test that all tools have valid structure."""
    tools = get_autogen_tools(agent_kit)

    for tool in tools:
        assert tool.name
        assert tool.description
        assert tool.schema
        assert tool.run


"""Test tool invocation and execution"""


@pytest.mark.asyncio
async def test_tool_invocation(agent_kit: AgentKit):
    """Test that tools can be invoked and executed."""
    tools = get_autogen_tools(agent_kit)

    add_tool = next(t for t in tools if "add_numbers" in t.name)
    add_schema_model = add_tool.args_type()
    result = await add_tool.run(add_schema_model(a=5, b=3))
    assert isinstance(result, str)
    assert result == "The sum of 5 and 3 is 8"

    subtract_tool = next(t for t in tools if "subtract_numbers" in t.name)
    subtract_schema_model = subtract_tool.args_type()
    result = await subtract_tool.run(subtract_schema_model(a=10, b=4))
    assert isinstance(result, str)
    assert result == "The result of 10 minus 4 is 6"


@pytest.mark.asyncio
async def test_tool_invocation_with_no_schema(agent_kit: AgentKit):
    """Test that tools with no schema can be invoked and executed."""
    tools = get_autogen_tools(agent_kit)

    # tool with no schema
    wallet_info_tool = next(t for t in tools if "get_wallet_info" in t.name)

    # Check that the tool can be invoked with no arguments
    result = await wallet_info_tool.run()
    assert "Wallet: test_wallet" in result
    assert "Address: addr_9876543210" in result
    assert "Balance: 22.0" in result


"""Test integration with agent kit"""


@pytest.mark.asyncio
async def test_agent_using_tools(agent_kit: AgentKit) -> None:
    """Test that an agent can successfully use the converted tools."""
    load_dotenv()

    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY is not set")

    tools = get_autogen_tools(agent_kit)

    agent = AssistantAgent(
        name="assistant",
        model_client=OpenAIChatCompletionClient(model="gpt-4o-mini"),
        tools=tools,
        system_message="You are a helpful math agent. When asked to perform calculations, use the appropriate tool and include the result in your response.",
    )

    prompt = """Please help me with two calculations:
    1. What is 15 plus 7?
    2. What is 20 minus 8?"""

    result = await agent.run(task=prompt, output_task_messages=False)

    # Check that both tools were called
    tool_exec_event = next(m for m in result.messages if m.type == "ToolCallExecutionEvent")
    tool_names = [tool_exec.name for tool_exec in tool_exec_event.content]
    assert "MockActionProvider_add_numbers" in tool_names
    assert "MockActionProvider_subtract_numbers" in tool_names

    # Check that both calculations were performed and results are in the response
    output_message = next(m for m in result.messages if m.type == "ToolCallSummaryMessage")
    assert "22" in output_message.content  # 15 + 7 = 22
    assert "12" in output_message.content  # 20 - 8 = 12
