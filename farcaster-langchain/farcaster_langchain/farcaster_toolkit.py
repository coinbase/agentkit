"""FarcasterToolkit."""

from cdp_agentkit_core.actions.social.farcaster import FARCASTER_ACTIONS
from langchain_core.tools import BaseTool
from langchain_core.tools.base import BaseToolkit

from farcaster_langchain.farcaster_api_wrapper import FarcasterApiWrapper
from farcaster_langchain.farcaster_tool import FarcasterTool


class FarcasterToolkit(BaseToolkit):
    """Farcaster Toolkit."""

    tools: list[BaseTool] = []  # noqa: RUF012

    @classmethod
    def from_farcaster_api_wrapper(cls, farcaster_api_wrapper: FarcasterApiWrapper) -> "FarcasterToolkit":
        """Create a FarcasterToolkit from a FarcasterApiWrapper.

        Args:
            farcaster_api_wrapper: FarcasterApiWrapper. The Farcaster API wrapper.

        Returns:
            FarcasterToolkit. The Farcaster toolkit.
        """
        actions = FARCASTER_ACTIONS

        tools = [
            FarcasterTool(
                name=action.name,
                description=action.description,
                farcaster_api_wrapper=farcaster_api_wrapper,
                args_schema=action.args_schema,
                func=action.func,
            )
            for action in actions
        ]

        return cls(tools=tools)  # type: ignore[arg-type]

    def get_tools(self) -> list[BaseTool]:
        """Get the tools in the toolkit."""
        return self.tools 