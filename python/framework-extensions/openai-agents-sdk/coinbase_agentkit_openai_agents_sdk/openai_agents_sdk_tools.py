"""OpenAI Agents SDK integration tools for AgentKit."""

import json
from typing import Any

from coinbase_agentkit import Action, AgentKit
from agents import FunctionTool, RunContextWrapper

def get_openai_agents_sdk_tools(agent_kit: AgentKit) -> list[FunctionTool]:
    """Get OpenAI Agents SDK tools from an AgentKit instance.

    Args:
        agent_kit: The AgentKit instance

    Returns:
        A list of OpenAI Agents SDK tools

    """
    actions: list[Action] = agent_kit.get_actions()

    tools = []
    for action in actions:
        async def invoke_tool(ctx: RunContextWrapper[Any], input_str: str, action=action) -> str:
            args = json.loads(input_str) if input_str else {}
            return str(action.invoke(args))

        tool = FunctionTool(
            name=action.name,
            description=action.description,
            params_json_schema=action.args_schema.model_json_schema(),
            on_invoke_tool=invoke_tool,
        )
        tools.append(tool)

    return tools

