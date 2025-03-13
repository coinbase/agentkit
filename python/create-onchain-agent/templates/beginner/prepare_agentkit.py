import os

from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    SmartWalletProvider,
    SmartWalletProviderConfig,
    cdp_api_action_provider,
    erc20_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from wallet import get_wallet_signer, save_wallet

"""
AgentKit Configuration

This file serves as the entry point for configuring AgentKit tools and wallet providers.
It handles wallet setup, persistence, and initializes AgentKit with the appropriate providers.

# Key Steps to Configure AgentKit:

1. Set up your WalletProvider:
   - Learn more: https://github.com/coinbase/agentkit/tree/main/python/agentkit#evm-wallet-providers

2. Set up your Action Providers:
   - Action Providers define what your agent can do.
   - Choose from built-in providers or create your own:
     - Built-in: https://github.com/coinbase/agentkit/tree/main/python/coinbase-agentkit#create-an-agentkit-instance-with-specified-action-providers
     - Custom: https://github.com/coinbase/agentkit/tree/main/python/coinbase-agentkit#creating-an-action-provider

# Next Steps:

- Explore the AgentKit README: https://github.com/coinbase/agentkit
- Learn more about available WalletProviders & Action Providers.
- Experiment with custom Action Providers for your unique use case.

## Want to contribute?
Join us in shaping AgentKit! Check out the contribution guide:
- https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md
- https://discord.gg/CDP
"""

# Configure network ID
network_id = os.getenv("NETWORK_ID", "base-sepolia")

def prepare_agentkit():
    """Initialize CDP Smart Wallet Agentkit and return tools."""
    # Get wallet signer to use for wallet provider
    signer, smart_wallet_address = get_wallet_signer(network_id)

    # Initialize Smart Wallet Provider first (without signer) to pass to get_wallet_signer
    wallet_provider = SmartWalletProvider(SmartWalletProviderConfig(
        network_id=network_id,
        signer=signer,
        smart_wallet_address=smart_wallet_address,
        paymaster_url=None, # Place your paymaster URL here: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    ))

    # Save wallet to file for reuse
    save_wallet(wallet_provider, network_id)

    # Initialize Action Providers
    action_providers = [
        cdp_api_action_provider(),
        erc20_action_provider(),
        wallet_action_provider(),
        weth_action_provider(),
    ]

    # Initialize AgentKit
    agentkit = AgentKit(AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=action_providers
    ))

    return agentkit
