"""PydanticAI integration tools for AgentKit."""

import warnings
from collections.abc import Callable
from typing import Any

import nest_asyncio
import pkg_resources
from pydantic_ai import Tool

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


def _get_action_annotations(action: Action) -> dict[str, Any]:
    """Extract type annotations from an action's argument schema.

    This function processes the Pydantic model fields of an action's argument schema
    to create a dictionary of type annotations suitable for PydanticAI tool functions.
    It includes error handling for cases where schema processing might fail.

    Args:
        action (Action): The AgentKit action to extract annotations from. Must have
            an args_schema attribute with model_fields.

    Returns:
        dict[str, Any]: A dictionary mapping argument names to their type annotations.
            Includes a 'return' key mapped to str when schema processing succeeds.
            Returns an empty dict if schema processing fails or if no schema is available.

    Note:
        - Falls back to Any type for fields without clear annotations
        - Gracefully handles exceptions during schema processing
        - Only adds 'return': str annotation when schema processing succeeds

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
            # If schema processing fails, return empty dict
            return {}
    return {}


def get_pydantic_ai_tools(agent_kit: AgentKit) -> list[Tool]:
    """Convert AgentKit actions to PydanticAI-compatible tools.

    This function takes an AgentKit instance and converts all its available actions
    into PydanticAI Tool objects. Each tool maintains the original action's name,
    description, and argument schema while providing proper integration with the
    PydanticAI framework.

    Args:
        agent_kit (AgentKit): An initialized AgentKit instance containing the actions
            to be converted. The instance should have properly configured action
            providers and wallet providers.

    Returns:
        list[Tool]: A list of PydanticAI Tool objects, where each tool corresponds
            to an AgentKit action. The tools can be directly used with PydanticAI
            agents and will automatically handle argument validation and execution.

    Note:
        - Each tool function returns string representations of action results
        - JSON schemas are properly transferred from AgentKit action schemas
        - All tools are configured with takes_ctx=False for simplicity

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
