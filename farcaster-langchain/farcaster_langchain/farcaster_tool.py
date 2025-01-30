"""Tool for interacting with Farcaster."""

from typing import Any, Callable, Type

from pydantic import BaseModel

from langchain_core.tools import BaseTool
from farcaster_langchain.farcaster_api_wrapper import FarcasterApiWrapper


class FarcasterTool(BaseTool):
    """Tool for interacting with Farcaster."""

    name: str
    description: str
    farcaster_api_wrapper: FarcasterApiWrapper
    func: Callable
    args_schema: Type[BaseModel]

    def _run(self, **kwargs: Any) -> str:
        """Use the tool."""
        # Pass the wrapper instance to the function
        return self.func(self.farcaster_api_wrapper, **kwargs)

    async def _arun(self, **kwargs: Any) -> str:
        """Use the tool asynchronously."""
        raise NotImplementedError("FarcasterTool does not support async") 