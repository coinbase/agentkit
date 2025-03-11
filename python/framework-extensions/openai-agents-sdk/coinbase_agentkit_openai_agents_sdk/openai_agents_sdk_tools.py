"""OpenAI Agents SDK integration tools for AgentKit."""

import json
from typing import Any

from coinbase_agentkit import Action, AgentKit
from agents import FunctionTool, RunContextWrapper

def _fix_schema_for_openai(schema: dict) -> None:
    """Recursively fix schema to meet OpenAI's requirements."""
    if not isinstance(schema, dict):
        return

    # Add additionalProperties: false to this level
    schema["additionalProperties"] = False

    # Handle properties
    if "properties" in schema:
        # Make all properties required at this level
        schema["required"] = list(schema["properties"].keys())
        
        # Process each property
        for prop in schema["properties"].values():
            if isinstance(prop, dict):
                prop.pop("default", None)
                _fix_schema_for_openai(prop)

    # Handle anyOf/oneOf/allOf fields
    for field in ["anyOf", "oneOf", "allOf"]:
        if field in schema:
            for subschema in schema[field]:
                _fix_schema_for_openai(subschema)

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

        # Get the schema and modify it for OpenAI compatibility
        schema = action.args_schema.model_json_schema()
        _fix_schema_for_openai(schema)

        tool = FunctionTool(
            name=action.name,
            description=action.description,
            params_json_schema=schema,
            on_invoke_tool=invoke_tool,
        )
        tools.append(tool)

    return tools

