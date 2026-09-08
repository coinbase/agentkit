"""WalletForge x402 AgentKit example: unpaid 402 smoke + provider wiring.

Unpaid smoke does not spend USDC. Paid AgentKit calls settle real Base USDC —
do not run paid settles in CI.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from coinbase_agentkit import walletforge_action_provider
from coinbase_agentkit.action_providers.walletforge.client import WalletForgeClient
from coinbase_agentkit.network import Network


def unpaid_smoke() -> int:
    """POST /v1/fetch-markdown without payment and print the 402 challenge."""
    print("Unpaid 402 smoke against https://api.walletforge.app (no spend)...")
    resp = WalletForgeClient.unpaid_challenge(
        "/v1/fetch-markdown",
        {"url": "https://example.com"},
    )
    print(f"status={resp.status_code}")
    if resp.payment_required:
        accepted = (resp.payment_required.get("accepts") or [{}])[0]
        print(
            json.dumps(
                {
                    "amount": accepted.get("amount"),
                    "payTo": accepted.get("payTo"),
                    "network": accepted.get("network"),
                    "asset": accepted.get("asset"),
                },
                indent=2,
            )
        )
        if resp.status_code != 402:
            print("Expected HTTP 402", file=sys.stderr)
            return 1
        if str(accepted.get("amount")) != "50000":
            print(f"Unexpected amount {accepted.get('amount')}", file=sys.stderr)
            return 1
    else:
        print("No PAYMENT-REQUIRED header", file=sys.stderr)
        return 1
    print("ok")
    return 0


def show_provider() -> int:
    """Construct walletforge_action_provider() and print AgentKit wiring."""
    provider = walletforge_action_provider()
    network = Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    print(f"provider={provider.name}")
    print(f"supports_network(base-mainnet)={provider.supports_network(network)}")
    print(
        """
# AgentKit wiring (paid calls spend Base USDC):

from coinbase_agentkit import AgentKit, AgentKitConfig, walletforge_action_provider

agent_kit = AgentKit(
    AgentKitConfig(
        wallet_provider=wallet_provider,  # EVM wallet on Base mainnet
        action_providers=[walletforge_action_provider()],
    )
)
"""
    )
    if not (
        os.getenv("BUYER_PRIVATE_KEY")
        or os.getenv("X402_BUYER_PRIVATE_KEY")
        or os.getenv("PRIVATE_KEY")
    ):
        print("Set BUYER_PRIVATE_KEY (or use an AgentKit wallet) before paid actions.")
    return 0


def main() -> int:
    """Run the WalletForge example."""
    parser = argparse.ArgumentParser(description="WalletForge x402 AgentKit example")
    parser.add_argument(
        "--skip-unpaid",
        action="store_true",
        help="Skip the live unpaid 402 smoke request",
    )
    args = parser.parse_args()
    show_provider()
    if args.skip_unpaid:
        return 0
    return unpaid_smoke()


if __name__ == "__main__":
    sys.exit(main())
