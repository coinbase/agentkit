"""CLI argument handling for the action provider generator script."""

import sys
from contextlib import suppress

import typer

from .types import NetworkId, ProtocolFamily, WalletProvider


def parse_cli_args() -> (
    tuple[
        str | None,
        ProtocolFamily | None,
        list[NetworkId] | None,
        WalletProvider | None,
        bool,
    ]
):
    """Parse CLI arguments.

    Returns:
        tuple: (name, protocol_family, networks, wallet_provider, interactive)

    """
    if len(sys.argv) <= 1:
        return None, None, None, None, False

    app = typer.Typer()

    result = {
        "name": None,
        "protocol_family": None,
        "networks": None,
        "wallet_provider": None,
        "interactive": False,
    }

    @app.command()
    def main(
        name: str = typer.Option(None, "--name", "-n", help="Name of the action provider"),
        protocol_family: str = typer.Option(
            None, "--protocol-family", "-p", help="Protocol family (e.g. evm, all)"
        ),
        networks: str = typer.Option(
            None, "--networks", "-t", help="Comma-separated list of networks"
        ),
        wallet_provider: str = typer.Option(
            None, "--wallet-provider", "-w", help="Wallet provider to use (optional)"
        ),
        interactive: bool = typer.Option(
            False, "--interactive", "-i", help="Enable interactive mode"
        ),
    ):
        result["name"] = name
        if protocol_family == "evm":
            result["protocol_family"] = protocol_family
        result["networks"] = [id.strip() for id in networks.split(",")] if networks else None
        result["wallet_provider"] = wallet_provider
        result["interactive"] = interactive

    with suppress(SystemExit):
        app()

    return (
        result["name"],
        result["protocol_family"],
        result["networks"],
        result["wallet_provider"],
        result["interactive"],
    )
