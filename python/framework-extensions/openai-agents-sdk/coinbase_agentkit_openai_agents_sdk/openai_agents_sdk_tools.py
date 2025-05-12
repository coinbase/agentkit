"""OpenAI Agents SDK integration tools for AgentKit."""

import json
import warnings
from typing import Any

import nest_asyncio
import pkg_resources
from agents import FunctionTool, RunContextWrapper

from coinbase_agentkit import Action, AgentKit

# Apply nest-asyncio to allow nested event loops
nest_asyncio.apply()


def _check_web3_version() -> bool:
    """Check if web3 version is compatible with voice features.

    Returns:
        bool: True if web3 version is >= 7.10.0, False otherwise

    """
    try:
        web3_version = pkg_resources.get_distribution("web3").version
        is_compatible = pkg_resources.parse_version(web3_version) >= pkg_resources.parse_version(
            "7.10.0"
        )
        if not is_compatible:
            warnings.warn(
                f"Voice features require web3 >= 7.10.0, but found version {web3_version}. "
                "Voice features will be disabled. Please upgrade web3 to enable voice functionality.",
                UserWarning,
                stacklevel=2,
            )
        return is_compatible
    except pkg_resources.DistributionNotFound:
        warnings.warn(
            "web3 package not found. Voice features will be disabled. "
            "Please install web3 >= 7.10.0 to enable voice functionality.",
            UserWarning,
            stacklevel=2,
        )
        return False


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

    # Check web3 version for voice compatibility
    _check_web3_version()  # This will print a warning if version is incompatible

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
