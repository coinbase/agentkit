"""Interactive prompts for the action provider generator script."""

import questionary
from rich import print

from .constants import (
    NETWORKS_BY_PROTOCOL,
    PROTOCOL_FAMILIES,
    WALLET_PROVIDERS_BY_PROTOCOL,
)
from .types import NetworkId, ProtocolFamily, WalletProvider
from .utils import validate_name


def prompt_for_name() -> str:
    """Prompt for the action provider name.

    Returns:
        str: The validated provider name

    """
    while True:
        name = questionary.text(
            "Enter the name for your action provider (e.g. mytoken)",
            validate=lambda text: validate_name(text)
            or "Must start with a letter and contain only lowercase letters, numbers, and underscores",
        ).ask()

        if name:
            return name.lower()


def prompt_for_protocol_family() -> ProtocolFamily:
    """Prompt for protocol family selection.

    Returns:
        ProtocolFamily: The selected protocol family

    """
    choices = [
        questionary.Choice(title=f"{pf['title']} ({pf['description']})", value=pf["value"])
        for pf in PROTOCOL_FAMILIES
    ]

    return questionary.select(
        "Select target blockchain protocol:",
        choices=choices,
    ).ask()


def prompt_for_networks(protocol_family: ProtocolFamily) -> list[NetworkId]:
    """Prompt for network selection using questionary checkboxes.

    Args:
        protocol_family: The protocol family to get networks for

    Returns:
        List[NetworkId]: List of selected network IDs. Empty list if "all" is selected.

    """
    if protocol_family is None:
        return []

    networks = NETWORKS_BY_PROTOCOL[protocol_family]
    choices = [
        questionary.Choice(
            title=f"{network['title']} ({network['description']})", value=network["value"]
        )
        for network in networks
    ]

    print(
        f"\n[dim]Note: Selecting 'All {protocol_family.upper()} Networks' will clear other selections[/dim]"
    )

    selected = questionary.checkbox(
        "Select target networks",
        choices=choices,
        validate=lambda x: len(x) > 0 or "Please select at least one network",
        instruction="Use space to select, enter to confirm",
    ).ask()

    if "all" in selected:
        return []

    return selected


def should_prompt_for_wallet_provider() -> bool:
    """Ask if user wants to specify a wallet provider.

    Returns:
        bool: True if should prompt for wallet provider

    """
    return questionary.confirm(
        "Would you like to specify a wallet provider?",
        default=False,
    ).ask()


def prompt_for_wallet_provider(protocol_family: ProtocolFamily) -> WalletProvider | None:
    """Prompt for wallet provider selection.

    Args:
        protocol_family: The protocol family to get wallet providers for

    Returns:
        WalletProvider | None: The selected wallet provider or None if not selected

    """
    key = "all" if protocol_family is None else protocol_family
    providers = WALLET_PROVIDERS_BY_PROTOCOL[key]
    choices = [
        questionary.Choice(
            title=f"{provider['title']} - {provider['description']}", value=provider["value"]
        )
        for provider in providers
    ]

    return questionary.select(
        f"Select wallet provider for {protocol_family.upper()}",
        choices=choices,
    ).ask()


def prompt_for_overwrite(name: str) -> bool:
    """Prompt for overwrite confirmation if provider exists.

    Args:
        name: The provider name

    Returns:
        bool: True if should overwrite

    """
    return questionary.confirm(
        f"Provider '{name}' already exists. Overwrite?",
        default=False,
    ).ask()
