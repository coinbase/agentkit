"""Tool allows agents to interact with the cdp-sdk library and control an MPC Wallet onchain."""

from collections.abc import Callable
from typing import Any

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from ..utils import CdpAgentkitWrapper


class CdpTool(BaseTool):
    """Tool for interacting with the CDP SDK."""

    cdp_agentkit_wrapper: CdpAgentkitWrapper = Field(
        ..., description="CDP AgentKit wrapper instance"
    )
    name: str = Field(default="")
    description: str = Field(default="")
    args_schema: type[BaseModel] | None = Field(default=None)
    func: Callable[..., str] = Field(..., description="Function to execute")

    def _run(self, instructions: str | None = "", **kwargs: Any) -> str:
        """Use the CDP SDK to run an operation."""
        if not instructions or instructions == "{}":
            instructions = ""

        if self.args_schema is not None:
            # Include instructions in kwargs when using schema
            kwargs["instructions"] = instructions
            validated_input_data = self.args_schema(**kwargs)
            parsed_input_args = validated_input_data.model_dump()
        else:
            parsed_input_args = {"instructions": instructions}

        return self.cdp_agentkit_wrapper.run_action(self.func, **parsed_input_args)
