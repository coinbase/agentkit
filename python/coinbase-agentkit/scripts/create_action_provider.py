#!/usr/bin/env python3
"""Action Provider Generator Script.

This script provides an interactive CLI for creating new action providers.
It guides users through selecting EVM networks and wallet providers,
then generates all necessary files with appropriate boilerplate code.

@module scripts/create-action-provider
"""


import questionary
import typer
from rich import print
from rich.console import Console

from .constants import (
    NETWORKS_BY_PROTOCOL,
    WALLET_PROVIDERS_BY_PROTOCOL,
)
from .types import NetworkId, ProviderConfig, WalletProvider
from .utils import (
    create_provider_files,
    display_banner,
    display_success_message,
    validate_name,
)

console = Console()

def prompt_for_name() -> str:
    """Prompt for the action provider name.

    Returns:
        str: The validated provider name

    """
    while True:
        name = questionary.text(
            "Enter the name for your action provider (e.g. 'mytoken', 'superfluid')",
            validate=lambda text: validate_name(text) or "Must start with a letter and contain only lowercase letters, numbers, and underscores"
        ).ask()

        if name:
            return name.lower()

def prompt_for_networks() -> list[NetworkId]:
    """Prompt for EVM network selection using questionary checkboxes.

    Returns:
        List[NetworkId]: List of selected network IDs. Empty list if "all" is selected.

    """
    networks = NETWORKS_BY_PROTOCOL["evm"]

    choices = [
        questionary.Choice(
            title=f"{network['title']} ({network['description']})",
            value=network["value"],
            checked=i == 0
        )
        for i, network in enumerate(networks)
    ]

    print("\n[dim]Note: Selecting 'All EVM Networks' will clear other selections[/dim]")

    selected = questionary.checkbox(
        "Select target networks",
        choices=choices,
        validate=lambda x: len(x) > 0 or "Please select at least one network",
        instruction="Use space to select, enter to confirm",
    ).ask()

    if "all" in selected:
        return []

    return selected

def prompt_for_wallet_provider() -> WalletProvider:
    """Prompt for EVM wallet provider selection using questionary.

    Returns:
        WalletProvider: The selected wallet provider

    """
    providers = WALLET_PROVIDERS_BY_PROTOCOL["evm"]

    choices = [
        questionary.Choice(
            title=f"{provider['title']} - {provider['description']}",
            value=provider["value"]
        )
        for provider in providers
    ]

    return questionary.select(
        "Select wallet provider",
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

def create_action_provider() -> None:
    """Create a new action provider interactively."""
    display_banner()

    name = prompt_for_name()
    network_ids = prompt_for_networks()
    wallet_provider = prompt_for_wallet_provider()

    config: ProviderConfig = {
        "name": name,
        "protocol_family": "evm",
        "network_ids": network_ids,
        "wallet_provider": wallet_provider,
    }

    create_provider_files(config)
    display_success_message(name)

def main() -> None:
    """Execute the main entry point."""
    try:
        create_action_provider()
    except KeyboardInterrupt:
        print("\n\n[yellow]Operation cancelled by user.[/yellow]")
    except Exception as e:
        print(f"\n[red]Error: {e!s}[/red]")
        raise

if __name__ == "__main__":
    typer.run(main)
