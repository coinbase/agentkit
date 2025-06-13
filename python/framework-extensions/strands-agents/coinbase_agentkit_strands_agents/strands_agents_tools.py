"""Formatting AgentKit actions as tools for Strands Agents"""

import functools
import inspect
import nest_asyncio

from typing import Any, Callable, Dict, List
from strands import tool
from coinbase_agentkit import Action, AgentKit

# Apply nest-asyncio to allow nested event loops
nest_asyncio.apply()


def _generate_docstring_from_schema(action: Action) -> str:
    """Generate a formatted docstring from an AgentKit action's schema.

    This function creates a properly formatted docstring that includes the action's
    description and a structured Args section based on the action's argument schema.

    Args:
        action: An AgentKit Action object containing the schema and description
            to be converted into a docstring.

    Returns:
        A formatted string containing the action description followed by an Args
        section listing all parameters with their descriptions.
    """
    schema = action.args_schema.model_json_schema()

    # Start with the action description
    docstring = f"{action.description}\n\n"

    # Add Args section if there are properties
    if "properties" in schema and schema["properties"]:
        docstring += "Args:\n"
        for prop_name, prop_info in schema["properties"].items():
            desc = prop_info.get("description", "")
            docstring += f"    {prop_name}: {desc}\n"

    return docstring


def _infer_type_hints(action: Action) -> Dict[str, Any]:
    """Infer Python type hints from JSON schema types in an action's schema.

    This function maps JSON schema types to their corresponding Python type hints.
    It handles basic types (string, integer, number, boolean, object, array) and
    falls back to Any for complex types or when anyOf/oneOf is used.

    Args:
        action: An AgentKit Action object containing the args_schema from which
            to infer type hints.

    Returns:
        A dictionary mapping parameter names to their inferred Python types.
        Keys are parameter names (str) and values are Python type objects.

    Note:
        - JSON "number" is mapped to Python float
        - JSON "object" is mapped to Python dict
        - JSON "array" is mapped to Python list
        - Complex schemas with anyOf/oneOf are mapped to Any
    """
    schema = action.args_schema.model_json_schema()
    type_hints = {}

    if "properties" in schema:
        for prop_name, prop_info in schema["properties"].items():
            # Simple type mapping - expand as needed
            json_type = prop_info.get("type")
            if json_type == "string":
                type_hints[prop_name] = str
            elif json_type == "integer":
                type_hints[prop_name] = int
            elif json_type == "number":
                type_hints[prop_name] = float
            elif json_type == "boolean":
                type_hints[prop_name] = bool
            elif json_type == "object":
                type_hints[prop_name] = dict
            elif json_type == "array":
                type_hints[prop_name] = list
            else:
                type_hints[prop_name] = Any

            # Handle anyOf/oneOf cases
            if "anyOf" in prop_info or "oneOf" in prop_info:
                type_hints[prop_name] = Any

    return type_hints


def create_strands_tool(action: Action) -> Callable:
    """Create a Strands-compatible tool function from an AgentKit action.

    This function transforms an AgentKit Action into a callable function that is
    compatible with the Strands framework. It dynamically creates a function with
    the proper signature, type hints, and docstring based on the action's schema,
    then wraps it with the Strands @tool decorator.

    Args:
        action: An AgentKit Action object to be converted into a Strands tool.
            The action must have a name, description, and args_schema.

    Returns:
        A decorated function that:
        - Has the same name as the action
        - Has parameters matching the action's schema
        - Has proper type hints inferred from the schema
        - Has a generated docstring describing the action and its parameters
        - Returns a standardized response dict with status and content
        - Is decorated with the Strands @tool decorator

    Raises:
        Exception: Any exception from action.invoke() is caught and returned
            as an error response with status='error'.
    """
    # Get type hints and parameter info from the schema
    type_hints = _infer_type_hints(action)

    # Define a generic function that will become our template
    def template_function(*args, **kwargs):
        # This function will be replaced with a properly-parameterized version
        pass

    # Create parameters for our new function signature
    parameters = []
    for param_name in type_hints.keys():
        param = inspect.Parameter(
            name=param_name,
            kind=inspect.Parameter.POSITIONAL_OR_KEYWORD,
            annotation=type_hints.get(param_name, inspect.Parameter.empty)
        )
        parameters.append(param)

    # Create a new signature with these parameters
    new_signature = inspect.Signature(parameters, return_annotation=dict)

    # Create the action handler with proper parameter handling
    def action_handler(*args, **kwargs):
        try:
            # Convert positional args to named args
            param_names = list(type_hints.keys())
            all_kwargs = kwargs.copy()
            for i, arg in enumerate(args):
                if i < len(param_names):
                    all_kwargs[param_names[i]] = arg

            # Invoke the action with all arguments
            result = action.invoke(all_kwargs)
            return {
                "status": "success",
                "content": [{"text": result}]
            }
        except Exception as e:
            return {
                "status": "error",
                "content": [
                    {"text": f"Error:{e}"}
                ]
            }

    # Clone our template function
    tool_function = functools.update_wrapper(action_handler, template_function)

    # Update the function's signature, name and docstring
    tool_function.__signature__ = new_signature
    tool_function.__name__ = action.name
    tool_function.__doc__ = _generate_docstring_from_schema(action)
    tool_function.__annotations__ = {**type_hints, "return": dict}

    # Apply the @tool decorator
    decorated_func = tool(name=action.name)(tool_function)

    return decorated_func


def get_strands_tools(agent_kit: AgentKit) -> List[Callable]:
    """Get a list of Strands-compatible tool functions from an AgentKit instance.

    This function retrieves all available actions from an AgentKit instance and
    converts each one into a Strands-compatible tool function. This allows
    AgentKit actions to be used seamlessly within the Strands framework.

    Args:
        agent_kit: An initialized AgentKit instance containing the actions
            to be converted into Strands tools.

    Returns:
        A list of callable functions, each representing a Strands tool created
        from an AgentKit action. Each function is properly decorated and ready
        to be used with Strands agents.

    Note:
        The returned tools maintain all the functionality of the original
        AgentKit actions while being compatible with Strands' tool interface.
    """
    actions: List[Action] = agent_kit.get_actions()

    tools = []
    for action in actions:
        strands_tool = create_strands_tool(action)
        tools.append(strands_tool)

    return tools