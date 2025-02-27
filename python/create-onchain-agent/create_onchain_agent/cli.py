#!/usr/bin/env python3

import sys

# Enforce Python version 3.10 or 3.11
REQUIRED_MAJOR = 3
ALLOWED_MINORS = {10, 11}  # Only allow 3.10 and 3.11

if sys.version_info.major != REQUIRED_MAJOR or sys.version_info.minor not in ALLOWED_MINORS:
    print(f"Unsupported Python version: {sys.version}. Please use Python 3.10 or 3.11.")
    sys.exit(1)

import os
import click
import questionary
import re
import zipfile
import requests
import shutil
import platformdirs
from rich.console import Console
from copier import run_copy
from prompt_toolkit.styles import Style  # Import for custom styling
from pathlib import Path

# GitHub repo and folder path
GITHUB_ZIP_URL = "https://github.com/coinbase/agentkit/archive/refs/heads/main.zip"
TEMPLATE_SUBDIR = "agentkit-main/python/create-onchain-agent/templates/chatbot"
LOCAL_CACHE_DIR = Path(platformdirs.user_cache_dir("create-onchain-agent"))

console = Console()

# Define a custom style for Questionary prompts
custom_style = Style.from_dict({
    "question": "bold",       # Bold question text
    "answer": "bold white",         # Selected answer (cyan instead of yellow)
    "pointer": "bold cyan",   # Selection arrow (cyan)
    "highlighted": "bold cyan",  # Highlighted item (cyan)
    # "selected": "bold cyan",  # Selected option
})

NETWORK_CHOICES = [
    ("Ethereum Mainnet", "ethereum-mainnet"),
    ("Ethereum Sepolia", "ethereum-sepolia"),
    ("Polygon Mainnet", "polygon-mainnet"),
    ("Polygon Mumbai", "polygon-mumbai"),
    ("Base Mainnet", "base-mainnet"),
    ("Base Sepolia (default)", "base-sepolia"),
    ("Arbitrum Mainnet", "arbitrum-mainnet"),
    ("Arbitrum Sepolia", "arbitrum-sepolia"),
    ("Optimism Mainnet", "optimism-mainnet"),
    ("Optimism Sepolia", "optimism-sepolia"),
    ("Other (Enter EVM Chain ID)", "other"),
]

CDP_SUPPORTED_NETWORKS = {
    "base-mainnet",
    "base-sepolia",
    "ethereum-mainnet",
    "ethereum-sepolia",
    "polygon-mainnet",
    "polygon-mumbai",
}

VALID_PACKAGE_NAME_REGEX = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

def download_and_extract_template():
    """Downloads and extracts the chatbot template to a persistent location."""
    LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = LOCAL_CACHE_DIR / "repo.zip"
    extract_path = LOCAL_CACHE_DIR / "templates"

    # If the template is already downloaded, return its path
    if extract_path.exists():
        return str(extract_path)

    # Download the zip file
    response = requests.get(GITHUB_ZIP_URL)
    response.raise_for_status()

    with open(zip_path, "wb") as f:
        f.write(response.content)

    # Extract the template
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(LOCAL_CACHE_DIR)

    template_path = LOCAL_CACHE_DIR / TEMPLATE_SUBDIR
    if not template_path.exists():
        raise FileNotFoundError(f"Template path {TEMPLATE_SUBDIR} not found in ZIP.")

    # Move extracted template to a stable path
    shutil.move(str(template_path), str(extract_path))

    return str(extract_path)

@click.command()
def create_project():
    """Creates a new onchain agent project with interactive prompts."""
    
    ascii_art = """
     █████   ██████  ███████ ███    ██ ████████    ██   ██ ██ ████████ 
    ██   ██ ██       ██      ████   ██    ██       ██  ██  ██    ██    
    ███████ ██   ███ █████   ██ ██  ██    ██       █████   ██    ██    
    ██   ██ ██    ██ ██      ██  ██ ██    ██       ██  ██  ██    ██    
    ██   ██  ██████  ███████ ██   ████    ██       ██   ██ ██    ██    

                 Giving every AI agent a crypto wallet
    """

    console.print(f"[blue]{ascii_art}[/blue]")

    # Prompt for project name (default: "onchain-agent")
    project_name = questionary.text("Enter your project name:", default="onchain-agent", style=custom_style).ask().strip()

    project_path = os.path.join(os.getcwd(), project_name)

    if os.path.exists(project_path):
        console.print(f"[red]Error: Directory '{project_name}' already exists.[/red]")
        return

    # Attempt to generate a valid package name
    suggested_package_name = project_name.replace("-", "_").replace(" ", "_")

    if not VALID_PACKAGE_NAME_REGEX.match(suggested_package_name):
        # Prompt user if the generated package name is invalid
        package_name = questionary.text(
            "Enter a valid Python package name (letters, numbers, underscores only):",
            style=custom_style
        ).ask().strip()
    else:
        package_name = suggested_package_name

    # Select network using arrow keys
    # console.print("\n[cyan]Select a network:[/cyan]")
    
    network_name = questionary.select(
        "Choose a network network:",
        choices=[name for name, _ in NETWORK_CHOICES],
        default="Base Sepolia (default)",
        style=custom_style  # Apply custom styling
    ).ask()

    # Map selection to network key
    network = next(n for n in NETWORK_CHOICES if n[0] == network_name)[1]

    # If "Other" is selected, prompt for EVM Chain ID
    if network == "other":
        network = questionary.text(
            "Enter the EVM Chain ID for your custom network:",
            style=custom_style
        ).ask().strip()

    # Determine wallet provider
    if network in CDP_SUPPORTED_NETWORKS:
        wallet_provider = questionary.select(
            "Select a wallet provider:",
            choices=["CDP Wallet Provider", "Ethereum Account Wallet Provider"],
            default="CDP Wallet Provider",
            style=custom_style  # Apply custom styling
        ).ask()

        wallet_provider = "cdp" if wallet_provider.startswith("CDP") else "eth"
    else:
        console.print(f"[yellow]⚠️ CDP is not supported on {network}. Defaulting to Ethereum Account Wallet Provider.[/yellow]")
        wallet_provider = "eth"


    console.print(f"\n[blue]Creating your onchain agent project: {project_name}[/blue]")

    template_path = download_and_extract_template()

    # Run Copier with collected answers
    run_copy(
        template_path,
        project_path,
        data={
            "_project_name": project_name,
            "_package_name": package_name,
            "_network": network,
            "_wallet_provider": wallet_provider,
        },
    )

    console.print(f"[bold blue]Successfully created your AgentKit project in {project_path}[/bold blue]")

    console.print("\n[bold]What's Next?[/bold]")

    console.print(f"To get started, run the following commands:")
    console.print(f"  [gray]- cd {project_name}[/gray]")
    console.print(f"  [gray]- poetry install[/gray]")
    console.print(f"  [dim]- # Open .env.local and configure your API keys[/dim]")
    console.print(f"  [gray]- mv .env.local .env[/gray]")
    console.print(f"  [gray]- poetry run python chatbot.py[/gray]")

    console.print("\n[bold]Learn more[/bold]")
    console.print(f"  - Checkout the docs")
    console.print(f"    [blue]https://docs.cdp.coinbase.com/agentkit/docs/welcome[/blue]")
    console.print(f"  - Visit the repo")
    console.print(f"    [blue]http://github.com/coinbase/agentkit[/blue]")
    console.print(f"  - Join the community")
    console.print(f"    [blue]https://discord.gg/CDP[/blue]\n")

if __name__ == "__main__":
    create_project()
