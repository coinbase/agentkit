#!/usr/bin/env python3

import os
import re
import shutil
import sys
import zipfile
from pathlib import Path

import click
import platformdirs
import questionary
import requests
from copier import run_copy
from prompt_toolkit.styles import Style  # Import for custom styling
from rich.console import Console

# Enforce Python version 3.10 or 3.11
REQUIRED_MAJOR = 3
ALLOWED_MINORS = {10, 11}  # Only allow 3.10 and 3.11

if sys.version_info.major != REQUIRED_MAJOR or sys.version_info.minor not in ALLOWED_MINORS:
    print(f"Unsupported Python version: {sys.version}. Please use Python 3.10 or 3.11.")
    sys.exit(1)

# GitHub repo and folder path
GITHUB_ZIP_URL = "https://github.com/coinbase/agentkit/archive/refs/heads/main.zip"
TEMPLATES_SUBDIR = "agentkit-main/python/create-onchain-agent/templates"
LOCAL_CACHE_DIR = Path(platformdirs.user_cache_dir("create-onchain-agent"))

console = Console()

# Define a custom style for Questionary prompts
custom_style = Style.from_dict(
    {
        "question": "bold",  # Bold question text
        "answer": "bold white",  # Selected answer (cyan instead of yellow)
        "pointer": "bold cyan",  # Selection arrow (cyan)
        "highlighted": "bold cyan",  # Highlighted item (cyan)
        # "selected": "bold cyan",  # Selected option
    }
)

# Network constants
EVM_NETWORKS = [
    ("base-mainnet", "Base Mainnet"),
    ("base-sepolia", "Base Sepolia"),
    ("ethereum-mainnet", "Ethereum Mainnet"),
    ("ethereum-sepolia", "Ethereum Sepolia"),
    ("arbitrum-mainnet", "Arbitrum Mainnet"),
    ("arbitrum-sepolia", "Arbitrum Sepolia"),
    ("optimism-mainnet", "Optimism Mainnet"),
    ("optimism-sepolia", "Optimism Sepolia"),
    ("polygon-mainnet", "Polygon Mainnet"),
    ("polygon-mumbai", "Polygon Mumbai"),
]

# Framework constants
FRAMEWORKS = [
    ("Langchain", "langchain"),
    ("OpenAI Agents SDK", "openai_agents"),
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


def get_template_path(template_name: str, templates_path: str | None = None) -> str:
    """Get the template path either from a local directory or downloaded from GitHub.

    Args:
        templates_path: Optional path to local template directory
        template_name: The name of the template to get

    Returns:
        str: Path to the template directory

    """
    if templates_path:
        # Use provided template path
        local_template_path = Path(f"{templates_path}/{template_name}")
        if not local_template_path.exists():
            raise FileNotFoundError(
                f"Template path not found at {local_template_path}. "
                "Please provide a valid template directory path."
            )
        return str(local_template_path)

    # No template provided - download from GitHub
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

    template_path = LOCAL_CACHE_DIR / TEMPLATES_SUBDIR / template_name
    if not template_path.exists():
        raise FileNotFoundError(f"Template path {TEMPLATES_SUBDIR}/{template_name} not found in ZIP.")

    # Move extracted template to a stable path
    shutil.move(str(template_path), str(extract_path))

    return str(extract_path)


def get_network_choices(network_type: str) -> list:
    """Filter network choices based on network type (mainnet/testnet)."""
    return [
        (name, id)
        for id, name in EVM_NETWORKS
        if (network_type == "mainnet" and "mainnet" in id)
        or (
            network_type == "testnet"
            and any(net in id for net in ["sepolia", "mumbai", "devnet", "testnet"])
        )
    ]

def create_advanced_project(templates_path: str | None = None):
    """Create a new onchain agent project with advanced setup."""
    # Prompt for project name (default: "onchain-agent")
    project_name = (
        questionary.text("Enter your project name:", default="onchain-agent", style=custom_style)
        .ask()
        .strip()
    )

    project_path = os.path.join(os.getcwd(), project_name)

    if os.path.exists(project_path):
        console.print(f"[red]Error: Directory '{project_name}' already exists.[/red]")
        return

    # Attempt to generate a valid package name
    suggested_package_name = project_name.replace("-", "_").replace(" ", "_")

    if not VALID_PACKAGE_NAME_REGEX.match(suggested_package_name):
        # Prompt user if the generated package name is invalid
        package_name = (
            questionary.text(
                "Enter a valid Python package name (letters, numbers, underscores only):",
                style=custom_style,
            )
            .ask()
            .strip()
        )
    else:
        package_name = suggested_package_name

    # Choose framework
    framework_choices = [
        name + (" (default)" if id == "langchain" else "")
        for name, id in FRAMEWORKS
    ]
    framework_name = questionary.select(
        "Choose your agent framework:",
        choices=framework_choices,
        default="Langchain (default)",
        style=custom_style,
    ).ask()

    # Remove " (default)" suffix if present
    framework_name = framework_name.replace(" (default)", "")
    # Look up the framework ID from the name
    framework = next(id for name, id in FRAMEWORKS if name == framework_name)

    # Choose network type
    network_type = questionary.select(
        "Choose network type:",
        choices=[
            "Mainnet",
            "Testnet",
            "Custom Chain ID",
        ],
        style=custom_style,
    ).ask()

    network = None
    chain_id = None
    rpc_url = None

    if network_type == "Custom Chain ID":
        # Handle custom EVM network
        chain_id = questionary.text(
            "Enter your chain ID:",
            validate=lambda text: text.strip().isdigit() or "Chain ID must be a number",
            style=custom_style,
        ).ask()

        rpc_url = questionary.text(
            "Enter your RPC URL:",
            validate=lambda text: (
                text.strip().startswith(("http://", "https://"))
                or "RPC URL must start with http:// or https://"
            ),
            style=custom_style,
        ).ask()

        wallet_provider = "eth"  # Default to eth wallet provider for custom networks
    else:
        # Filter networks based on mainnet/testnet selection
        network_choices = get_network_choices(network_type.lower())
        network_name = questionary.select(
            "Choose a network:",
            choices=[
                name + (" (default)" if id == "base-sepolia" else "")
                for name, id in network_choices
            ],
            default="Base Sepolia (default)" if network_type == "Testnet" else None,
            style=custom_style,
        ).ask()

        # Remove " (default)" suffix if present
        network_name = network_name.replace(" (default)", "")
        network = next(id for name, id in network_choices if name == network_name)

    # Determine wallet provider
    if network:
        if network in CDP_SUPPORTED_NETWORKS:
            wallet_choices = [
                "Smart Wallet Provider",
                "CDP Wallet Provider",
                "Ethereum Account Wallet Provider",
            ]
            wallet_selection = questionary.select(
                "Select a wallet provider:",
                choices=wallet_choices,
                default="Smart Wallet Provider",
                style=custom_style,
            ).ask()

            if wallet_selection.startswith("CDP"):
                wallet_provider = "cdp"
            elif wallet_selection.startswith("Smart"):
                wallet_provider = "smart"
            else:
                wallet_provider = "eth"
        else:
            console.print(
                f"[yellow]⚠️ CDP is not supported on {network}. Defaulting to Ethereum Account Wallet Provider.[/yellow]"
            )
            wallet_provider = "eth"

    console.print(f"\n[blue]Creating your onchain agent project: {project_name}[/blue]")

    # Update the Copier data dict to include new fields
    copier_data = {
        "_project_name": project_name,
        "_package_name": package_name,
        "_network": network,
        "_wallet_provider": wallet_provider,
        "_framework": framework,
    }

    if chain_id:
        copier_data["_chain_id"] = chain_id
    if rpc_url:
        copier_data["_rpc_url"] = rpc_url

    try:
        template_path = get_template_path("chatbot", templates_path)
        run_copy(template_path, project_path, data=copier_data)

        console.print(
            f"[bold blue]Successfully created your AgentKit project in {project_path}[/bold blue]"
        )

        console.print("\n[bold]What's Next?[/bold]")

        console.print("To get started, run the following commands:")
        console.print(f"  [gray]- cd {project_name}[/gray]")
        console.print("  [gray]- poetry install[/gray]")
        console.print("  [dim]- # Open .env.local and configure your API keys[/dim]")
        console.print("  [gray]- mv .env.local .env[/gray]")
        console.print("  [gray]- poetry run python chatbot.py[/gray]")

        console.print("\n[bold]Learn more[/bold]")
        console.print("  - Checkout the docs")
        console.print("    [blue]https://docs.cdp.coinbase.com/agentkit/docs/welcome[/blue]")
        console.print("  - Visit the repo")
        console.print("    [blue]http://github.com/coinbase/agentkit[/blue]")
        console.print("  - Join the community")
        console.print("    [blue]https://discord.gg/CDP[/blue]\n")

    except FileNotFoundError as e:
        console.print(f"[red]Error: {e!s}[/red]")
        return

def create_beginner_project(templates_path: str | None = None):
    """Create a new onchain agent project with simplified setup."""
    # Prompt for project name (default: "onchain-agent")
    project_name = (
        questionary.text("Enter your project name:", default="onchain-agent", style=custom_style)
        .ask()
        .strip()
    )

    project_path = os.path.join(os.getcwd(), project_name)

    if os.path.exists(project_path):
        console.print(f"[red]Error: Directory '{project_name}' already exists.[/red]")
        return None, None

    # Attempt to generate a valid package name
    suggested_package_name = project_name.replace("-", "_").replace(" ", "_")

    if not VALID_PACKAGE_NAME_REGEX.match(suggested_package_name):
        # Prompt user if the generated package name is invalid
        package_name = (
            questionary.text(
                "Enter a valid Python package name (letters, numbers, underscores only):",
                style=custom_style,
            )
            .ask()
            .strip()
        )
    else:
        package_name = suggested_package_name

    framework_choices = [
        name + (" (default)" if id == "langchain" else "")
        for name, id in FRAMEWORKS
    ]
    framework_name = questionary.select(
        "Choose your agent framework:",
        choices=framework_choices,
        default="Langchain (default)",
        style=custom_style,
    ).ask()

    # Remove " (default)" suffix if present
    framework_name = framework_name.replace(" (default)", "")
    framework = next(id for name, id in FRAMEWORKS if name == framework_name)

    console.print(f"\n[blue]Creating your onchain agent project: {project_name}[/blue]")

    copier_data = {
        "_project_name": project_name,
        "_package_name": package_name,
        "_framework": framework,
    }

    try:
        template_path = get_template_path("beginner", templates_path)
        run_copy(template_path, project_path, data=copier_data)

        console.print(
            f"[bold blue]🎉 Successfully created your AI agent in {project_path}![/bold blue]"
        )

        console.print("\n[bold]What makes this agent special?[/bold]")
        console.print(
            "[gray]Your AI agent comes with a secure digital wallet on the Base Sepolia network - "
            "a network designed for development and testing with no financial risk. Your agent can:[/gray]\n"
            "[dim]  • Check wallet balances\n"
            "  • Send and receive tokens\n"
            "  • Make secure financial decisions\n[/dim]"
            "\n[gray]When you're ready to move to Base Mainnet, your agent will get $X in free transaction fees. "
            "You can change networks anytime by updating the NETWORK_ID in your .env file.[/gray]"
        )

        console.print("\n[bold]What's next?[/bold]")
        console.print("To get started, run the following commands:")
        console.print(f"  [gray]- cd {project_name}[/gray]")
        console.print("  [gray]- poetry install[/gray]")
        console.print("  [dim]- # Open .env.local and configure your API keys[/dim]")
        console.print("  [gray]- mv .env.local .env[/gray]")
        console.print("  [gray]- poetry run python chatbot.py[/gray]")

        console.print("\n[bold]Learn more[/bold]")
        console.print("  - Checkout the docs")
        console.print("    [blue]https://docs.cdp.coinbase.com/agentkit/docs/welcome[/blue]")
        console.print("  - Visit the repo")
        console.print("    [blue]http://github.com/coinbase/agentkit[/blue]")
        console.print("  - Join the community")
        console.print("    [blue]https://discord.gg/CDP[/blue]\n")

    except FileNotFoundError as e:
        console.print(f"[red]Error: {e!s}[/red]")
        return

@click.command()
@click.option("--templates-path", type=str, help="Path to local template directory", default=None)
@click.option(
    "--beginner",
    is_flag=True,
    help="Use beginner mode with simplified setup",
)
def create_project(templates_path, beginner):
    """Create a new onchain agent project with interactive prompts."""
    ascii_art = """
     █████   ██████  ███████ ███    ██ ████████    ██   ██ ██ ████████
    ██   ██ ██       ██      ████   ██    ██       ██  ██  ██    ██
    ███████ ██   ███ █████   ██ ██  ██    ██       █████   ██    ██
    ██   ██ ██    ██ ██      ██  ██ ██    ██       ██  ██  ██    ██
    ██   ██  ██████  ███████ ██   ████    ██       ██   ██ ██    ██

                 Giving every AI agent a crypto wallet
    """

    console.print(f"[blue]{ascii_art}[/blue]")

    if beginner:
        create_beginner_project(templates_path)
    else:
        create_advanced_project(templates_path)


if __name__ == "__main__":
    create_project()
