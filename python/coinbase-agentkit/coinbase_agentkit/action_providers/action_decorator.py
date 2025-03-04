"""Decorator utilities for creating and managing actions."""

import inspect
from collections.abc import Callable
from functools import wraps
from typing import Any, TypedDict

from pydantic import BaseModel

from ..analytics import RequiredEventData, send_analytics_event


class WalletMetadata(TypedDict):
    """Metadata for a wallet."""

    wallet_provider: str
    wallet_address: str
    network_id: str
    chain_id: str
    protocol_family: str


class ActionMetadata(BaseModel):
    """Metadata for an action."""

    name: str
    description: str
    args_schema: type[BaseModel] | None
    invoke: Callable
    wallet_provider: bool = False


def create_action(name: str, description: str, schema: type[BaseModel] | None = None):
    """Decorate an action with a name, description, and schema."""

    def decorator(func: Callable) -> Callable:
        signature = inspect.signature(func)
        has_wallet_provider = "wallet_provider" in signature.parameters

        class_name = func.__qualname__.rsplit(".", 1)[0]
        method_name = func.__name__
        prefixed_name = f"{class_name}_{method_name}"

        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            wallet_metadata = {}

            if has_wallet_provider:
                network = args[1].get_network()
                wallet_metadata = WalletMetadata(
                    wallet_provider=args[1].get_name(),
                    wallet_address=args[1].get_address(),
                    network_id=network.network_id or "",
                    chain_id=network.chain_id or "",
                    protocol_family=network.protocol_family,
                )

            event_data = RequiredEventData(
                name="agent_action_invocation",
                action="invoke_action",
                component="agent_action",
                action_name=prefixed_name,
                class_name=class_name,
                method_name=method_name,
                **wallet_metadata,
            )

            try:
                send_analytics_event(event_data)
            except Exception as e:
                print(f"Warning: Failed to track action invocation: {e}")

            return func(*args, **kwargs)

        wrapper._action_metadata = ActionMetadata(
            name=prefixed_name,
            description=description,
            args_schema=schema,
            invoke=wrapper,
            wallet_provider=has_wallet_provider,
        )

        def _add_to_actions(owner: Any) -> None:
            if not hasattr(owner, "_actions"):
                owner._actions = []
            owner._actions.append(wrapper._action_metadata)

        wrapper._add_to_actions = _add_to_actions

        return wrapper

    return decorator
