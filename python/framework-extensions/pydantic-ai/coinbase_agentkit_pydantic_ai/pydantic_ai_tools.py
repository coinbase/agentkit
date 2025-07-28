"""PydanticAI integration tools for AgentKit."""

import warnings
from collections.abc import Callable
from typing import Any

import nest_asyncio  # type: ignore
import pkg_resources
from pydantic_ai import Tool

from coinbase_agentkit import Action, AgentKit

# Apply nest-asyncio to allow nested event loops
nest_asyncio.apply()  # type: ignore


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


def _get_action_annotations(action: Action) -> dict[str, Any]:
    """Get the annotations for an action's arguments.

    Args:
        action (Action): The action to get the annotations for

    Returns:
        dict[str, Any]: The annotations for the action's arguments

    """
    if action.args_schema and hasattr(action.args_schema, "model_fields"):
        try:
            annotations: dict[str, Any] = {}
            for field_name, field_info in action.args_schema.model_fields.items():
                if hasattr(field_info, "annotation"):
                    annotations[field_name] = field_info.annotation
                else:
                    # Fallback to Any if annotation is not available
                    annotations[field_name] = Any
            annotations["return"] = str
            return annotations
        except Exception:
            # If schema processing fails, continue without annotations
            return {}
    return {}


def get_pydantic_ai_tools(agent_kit: AgentKit) -> list[Tool]:
    """Get PydanticAI compatible tools from an AgentKit instance.

    Args:
        agent_kit: The AgentKit instance

    Returns:
        A list of PydanticAI Tool objects

    """
    actions: list[Action] = agent_kit.get_actions()

    # Check web3 version for voice compatibility
    _check_web3_version()  # This will print a warning if version is incompatible

    tools: list[Tool] = []
    for action in actions:
        # Create closure to capture action properly
        def make_tool_function(action: Action) -> Callable[..., str]:
            def invoke_tool(**kwargs: Any) -> str:
                return str(action.invoke(kwargs))

            invoke_tool.__annotations__ = _get_action_annotations(action)

            return invoke_tool

        tool_function = make_tool_function(action)

        tool = Tool(
            tool_function, name=action.name, description=action.description, takes_ctx=False
        )
        if action.args_schema:
            tool.function_schema.json_schema = action.args_schema.model_json_schema()

        tools.append(tool)

    return tools
