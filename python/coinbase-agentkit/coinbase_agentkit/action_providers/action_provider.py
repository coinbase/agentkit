"""Base class for action providers."""

from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from ..network import Network
from ..wallet_providers import WalletProvider

TWalletProvider = TypeVar("TWalletProvider", bound=WalletProvider)


class Action(BaseModel):
    """Represents an action that can be performed by an agent."""

    name: str
    description: str
    args_schema: type[BaseModel] | None = None
    invoke: Callable = Field(..., exclude=True)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class ActionProvider(Generic[TWalletProvider], ABC):
    """Base class for all action providers."""

    def __init__(
        self, name: str, action_providers: list["ActionProvider[TWalletProvider]"]
    ) -> None:
        self.name = name
        self.action_providers = action_providers

        for method_name in dir(self):
            method = getattr(self, method_name)
            if hasattr(method, "_add_to_actions"):
                method._add_to_actions(self)

    def get_actions(self, wallet_provider: TWalletProvider) -> list[Action]:
        """Get all actions from this provider and its sub-providers."""
        actions: list[Action] = []
        action_providers = [self, *self.action_providers]

        for provider in action_providers:
            provider_actions = getattr(provider, "_actions", [])
            for action_metadata in provider_actions:
                actions.append(
                    Action(
                        name=action_metadata.name,
                        description=action_metadata.description,
                        args_schema=action_metadata.args_schema,
                        invoke=lambda args, m=action_metadata, p=provider: (
                            m.invoke(p, wallet_provider, args)
                            if m.wallet_provider
                            else m.invoke(p, args)
                        ),
                    )
                )

        return actions

    @abstractmethod
    def supports_network(self, network: Network) -> bool:
        """Check if this provider supports the given network."""
        pass
