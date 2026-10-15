"""Formatting AgentKit actions as CrewAI tools."""

from typing import Any

import nest_asyncio
from crewai.tools import BaseTool
from pydantic import BaseModel, ConfigDict, Field

from coinbase_agentkit import Action, AgentKit

# Apply nest-asyncio to allow nested event loops.
nest_asyncio.apply()


class EmptyCrewAIActionSchema(BaseModel):
    """Empty schema for AgentKit actions that do not accept arguments."""


class AgentKitCrewAITool(BaseTool):
    """CrewAI tool wrapper for an AgentKit action."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    action: Action = Field(exclude=True)
    name: str
    description: str
    args_schema: type[BaseModel] = EmptyCrewAIActionSchema

    @classmethod
    def from_action(cls, action: Action) -> "AgentKitCrewAITool":
        """Create a CrewAI tool from an AgentKit action."""
        return cls(
            action=action,
            name=action.name,
            description=action.description or "",
            args_schema=action.args_schema or EmptyCrewAIActionSchema,
        )

    def _run(self, **kwargs: Any) -> str:
        """Execute the wrapped AgentKit action."""
        return str(self.action.invoke(kwargs))


def get_crewai_tools(agent_kit: AgentKit) -> list[AgentKitCrewAITool]:
    """Get CrewAI-compatible tools from an AgentKit instance."""
    actions: list[Action] = agent_kit.get_actions()
    return [AgentKitCrewAITool.from_action(action) for action in actions]
