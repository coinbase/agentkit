"""Autogen integration tools for AgentKit."""

import asyncio
import inspect
from collections.abc import Awaitable, Callable
from typing import Any

import nest_asyncio
from autogen_core import CancellationToken
from autogen_core.tools import BaseTool
from pydantic import BaseModel, create_model

from coinbase_agentkit import Action, AgentKit

# Apply nest-asyncio to allow nested event loops
nest_asyncio.apply()


class AutogenTool(BaseTool[BaseModel, Any]):
    """A tool adapter for using AgentKit actions with Autogen.

    This class wraps functions or AgentKit actions into Autogen-compatible tools.
    It handles both synchronous and asynchronous functions, automatically converting
    them to the format expected by Autogen.

    Args:
        func (Callable[..., Any]): The function to be wrapped as a tool
        name (str): Name of the tool
        description (str): Description of what the tool does
        args_type (type[BaseModel] | None): Pydantic model defining the expected arguments
        return_type (type[Any] | None): Expected return type of the tool
        strict (bool): Whether to enforce strict type checking. Defaults to False.

    """

    def __init__(
        self,
        func: Callable[..., Any],
        name: str,
        description: str,
        args_type: type[BaseModel] | None = None,
        return_type: type[Any] | None = None,
        strict: bool = False,
    ):
        if return_type is None:
            return_type = str

        if args_type is None:
            args_type = create_model("EmptyModel")
        elif not issubclass(args_type, BaseModel):
            raise ValueError("args_type must be a subclass of BaseModel")

        self._func = func
        super().__init__(args_type, return_type, name, description, strict)

    @classmethod
    def from_action(cls, action: Action, strict: bool = False):
        """Create an AutogenTool instance from an AgentKit Action.

        This class method creates an AutogenTool that wraps an AgentKit Action,
        making it compatible with the Autogen framework. It preserves the action's
        name, description, and argument schema while providing proper integration.

        Args:
            action (Action): The AgentKit action to be converted into a tool
            strict (bool, optional): Whether to enforce strict type checking. Defaults to False.

        Returns:
            AutogenTool: A new AutogenTool instance that wraps the provided action

        Note:
            - The strict parameter controls whether all fields in the args_schema(BaseModel)
              must be required. As some action providers allow default values for fields,
              strict is set to False by default.

        """

        def create_tool_fn(_action):
            def tool_fn(**kwargs) -> str:
                return _action.invoke(kwargs)

            return tool_fn

        return_type = str

        return cls(
            func=create_tool_fn(action),
            name=action.name,
            description=action.description,
            args_type=action.args_schema,
            return_type=return_type,
            strict=strict,
        )

    async def run(
        self, args: BaseModel | None = None, _: CancellationToken | None = None
    ) -> Awaitable[Any]:
        """Execute the tool's function with the provided arguments.

        This method handles both synchronous and asynchronous function execution,
        automatically running synchronous functions in a separate thread to avoid
        blocking the event loop.

        Args:
            args (BaseModel | None, optional): Input arguments for the tool as a Pydantic model.
                If None, uses tool's args_type. Defaults to None.
            _ (CancellationToken | None, optional): Token for cancellation support.
                Currently unused. Defaults to None.

        Returns:
            Awaitable[Any]: The result of the tool's execution, wrapped in an awaitable.
            The actual return type matches the tool's configured return_type.

        Note:
            - CancellationToken is designed to control asynchronous run functions externally.
              For synchronous tool functions, which run in a separate thread to avoid blocking,
              the function cannot be forcefully terminated from outside unless the CancellationToken
              is directly injected into the synchronous function. Since most AgentKit actions
              are synchronous functions, CancellationToken is effectively unusable in the
              current implementation.

        """
        if args is None:
            args = self.args_type()()

        kwargs = args.model_dump()

        # Determine if the callable is asynchronous
        if inspect.iscoroutinefunction(self._func):
            return await self._func(**kwargs)
        else:
            # Run sync func in a thread to avoid blocking the event loop
            return await asyncio.to_thread(self._func, **kwargs)


def get_autogen_tools(agent_kit: AgentKit) -> list[AutogenTool]:
    """Convert AgentKit actions to Autogen-compatible tools.

    This function takes an AgentKit instance and converts all its available actions
    into Autogen Tool objects. Each tool maintains the original action's name,
    description, and argument schema while providing proper integration with the
    Autogen framework.

    Args:
        agent_kit (AgentKit): An initialized AgentKit instance containing the actions
            to be converted. The instance should have properly configured action
            providers and wallet providers.

    Returns:
        list[AutogenTool]: A list of Autogen Tool objects, where each tool corresponds
            to an AgentKit action. The tools can be directly used with Autogen
            agents and will automatically handle argument validation and execution.

    """
    actions: list[Action] = agent_kit.get_actions()
    tools = [AutogenTool.from_action(action) for action in actions]
    return tools
