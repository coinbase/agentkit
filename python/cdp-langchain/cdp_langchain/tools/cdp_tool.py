"""Tool allows agents to interact with the cdp-sdk library and control an MPC Wallet onchain.

To use this tool, you must first set as environment variables:
    CDP_API_KEY_NAME
    CDP_API_KEY_PRIVATE_KEY
    NETWORK_ID

"""

from collections.abc import Callable
from typing import Any

from langchain_core.callbacks import CallbackManagerForToolRun
from langchain_core.tools import BaseTool
from pydantic import BaseModel

from cdp_langchain.utils.cdp_agentkit_wrapper import CdpAgentkitWrapper


class CdpTool(BaseTool):  # type: ignore[override]
    """Tool for interacting with the CDP SDK."""

    cdp_agentkit_wrapper: CdpAgentkitWrapper
    name: str = ""
    description: str = ""
    args_schema: type[BaseModel] | None = None
    func: Callable[..., str]

    def _run(
        self,
        instructions: str | None = "",
        run_manager: CallbackManagerForToolRun | None = None,
        **kwargs: Any,
    ) -> str:
        """Use the CDP SDK to run an operation."""
        if not instructions or instructions == "{}":
            # Catch other forms of empty input that GPT-4 likes to send.
            instructions = ""
        if self.args_schema is not None:
            validated_input_data = self.args_schema(**kwargs)
            parsed_input_args = validated_input_data.model_dump()
        else:
            parsed_input_args = {"instructions": instructions}
        return self.cdp_agentkit_wrapper.run_action(self.func, **parsed_input_args)
