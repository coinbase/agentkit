"""LangChain integration tools for AgentKit."""

import asyncio

import nest_asyncio
from langchain.tools import StructuredTool

from coinbase_agentkit import Action, AgentKit

# nest-asyncio supports standard asyncio loops, but cannot patch uvloop.
try:
    _event_loop = asyncio.get_event_loop()
except RuntimeError:
    _event_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_event_loop)

if isinstance(_event_loop, asyncio.BaseEventLoop):
    nest_asyncio.apply(_event_loop)


def get_langchain_tools(agent_kit: AgentKit) -> list[StructuredTool]:
    """Get Langchain tools from an AgentKit instance.

    Args:
        agent_kit: The AgentKit instance

    Returns:
        A list of Langchain tools

    """
    actions: list[Action] = agent_kit.get_actions()

    tools = []
    for action in actions:

        def create_tool_fn(action=action):
            def tool_fn(**kwargs) -> str:
                return action.invoke(kwargs)

            return tool_fn

        tool = StructuredTool(
            name=action.name,
            description=action.description,
            func=create_tool_fn(action),
            args_schema=action.args_schema,
        )
        tools.append(tool)

    return tools
