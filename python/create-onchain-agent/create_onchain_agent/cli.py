#!/usr/bin/env python3

import click
import os
from rich.console import Console
from copier import run_copy

console = Console()
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "../templates/chatbot")

NETWORK_CHOICES = [
    "ethereum-mainnet",
    "ethereum-sepolia",
    "polygon-mainnet",
    "polygon-mumbai",
    "base-mainnet",
    "base-sepolia",
    "arbitrum-mainnet",
    "arbitrum-sepolia",
    "optimism-mainnet",
    "optimism-sepolia",
]

CDP_SUPPORTED_NETWORKS = {
    "base-mainnet",
    "base-sepolia",
    "ethereum-mainnet",
    "ethereum-sepolia",
    "polygon-mainnet",
    "polygon-mumbai",
}

@click.command()
def create_project():
    """Creates a new onchain agent project with interactive prompts."""
    
    # Prompt for project name
    project_name = click.prompt("Enter your project name")
    
    project_path = os.path.join(os.getcwd(), project_name)

    if os.path.exists(project_path):
        console.print(f"[red]Error: Directory '{project_name}' already exists.[/red]")
        return

    console.print(f"[blue]Creating your onchain agent project: {project_name}[/blue]")

    # Ask for the package name (default to sanitized project name)
    package_name = project_name.replace("-", "_").replace(" ", "_")

    # Select network
    console.print("\n[cyan]Select a network:[/cyan]")
    for i, network in enumerate(NETWORK_CHOICES, start=1):
        console.print(f"{i}. {network}")
    
    network_index = click.prompt("Enter the number of your selected network", type=int, default=6)
    network = NETWORK_CHOICES[network_index - 1]

    # Determine wallet provider
    if network in CDP_SUPPORTED_NETWORKS:
        console.print("\n[cyan]Select a wallet provider:[/cyan]")
        console.print("1. CDP Wallet Provider")
        console.print("2. Ethereum Account Wallet Provider")
        wallet_provider_choice = click.prompt("Enter the number of your wallet provider", type=int, default=1)
        wallet_provider = "cdp" if wallet_provider_choice == 1 else "eth"
    else:
        console.print(f"[yellow]⚠️ CDP is not supported on {network}. Defaulting to Ethereum Account Wallet Provider.[/yellow]")
        wallet_provider = "eth"

    # Run Copier with collected answers
    run_copy(
        TEMPLATE_PATH,
        project_path,
        data={
            "_project_name": project_name,
            "_package_name": package_name,
            "_network": network,
            "_wallet_provider": wallet_provider,
        },
    )

    console.print(f"[green]Project created successfully at {project_path}[/green]")
    console.print(f"Next steps:\n  cd {project_name}\n  poetry install\n  mv .env.local .env\n  poetry run python chatbot.py")

if __name__ == "__main__":
    create_project()
