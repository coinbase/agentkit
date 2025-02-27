#!/usr/bin/env python3
"""Action Provider Generator Script.

This script provides both CLI flags and interactive prompts for creating new action providers.
It guides users through selecting protocol families, networks, and wallet providers,
then generates all necessary files with appropriate boilerplate code.

@module scripts/create-action-provider
"""

from .args import parse_cli_args
from .config import prepare_provider_config
from .utils import create_provider_files, display_banner, display_success_message


def create_action_provider() -> None:
    """Create a new action provider using CLI args or interactive prompts."""
    display_banner()

    # Parse CLI args
    name, protocol_family, networks, wallet_provider, interactive = parse_cli_args()

    try:
        # Prepare config with CLI args and prompt fallbacks
        config = prepare_provider_config(
            name=name,
            protocol_family=protocol_family,
            networks=networks,
            wallet_provider=wallet_provider,
            interactive=interactive,
        )

        # Generate files
        create_provider_files(config)
        display_success_message(config.name)

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        print(f"\nError: {e!s}")
        raise


def main() -> None:
    """Execute the main entry point."""
    create_action_provider()
