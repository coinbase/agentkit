#!/usr/bin/env python3
"""Action Provider Generator Script.

This script provides both CLI flags and interactive prompts for creating new action providers.
It guides users through selecting protocol families, networks, and wallet providers,
then generates all necessary files with appropriate boilerplate code.

@module scripts/create-action-provider
"""

from pathlib import Path

from .args import parse_cli_args
from .config import prepare_provider_config
from .utils import (
    add_provider_files,
    display_banner,
    display_success_message,
    update_action_providers_init,
    update_agentkit_init,
)


def create_action_provider() -> None:
    """Create a new action provider using CLI args or interactive prompts."""
    display_banner()

    try:
        name, protocol_family, networks, wallet_provider, interactive = parse_cli_args()
        config = prepare_provider_config(
            name=name,
            protocol_family=protocol_family,
            networks=networks,
            wallet_provider=wallet_provider,
            interactive=interactive,
        )

        provider_dir = Path("coinbase_agentkit/action_providers") / config.name
        test_dir = Path("tests/action_providers") / config.name
        add_provider_files(config, provider_dir, test_dir)
        update_action_providers_init(config)
        update_agentkit_init(config)

        display_success_message(config.name)

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        print(f"\nError: {e!s}")
        raise


def main() -> None:
    """Execute the main entry point."""
    create_action_provider()


if __name__ == "__main__":
    main()
