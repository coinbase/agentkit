"""Coinbase AgentKit - Framework for enabling AI agents to take actions onchain."""

from .action_providers import (
    Action,
    ActionProvider,
    cdp_api_action_provider,
    cdp_wallet_action_provider,
    create_action,
    morpho_action_provider,
    pyth_action_provider,
    twitter_action_provider,
    wallet_action_provider,
    weth_action_provider,
)
from .agentkit import AgentKit, AgentKitOptions
from .wallet_providers import (
    CdpWalletProvider,
    CdpWalletProviderConfig,
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig,
    EvmWalletProvider,
    WalletProvider,
)

__version__ = "0.1.0"

__all__ = [
    "AgentKit",
    "AgentKitOptions",
    "Action",
    "ActionProvider",
    "create_action",
    "WalletProvider",
    "CdpWalletProvider",
    "CdpWalletProviderConfig",
    "EvmWalletProvider",
    "EthAccountWalletProvider",
    "EthAccountWalletProviderConfig",
    "cdp_api_action_provider",
    "cdp_wallet_action_provider",
    "morpho_action_provider",
    "pyth_action_provider",
    "twitter_action_provider",
    "wallet_action_provider",
    "weth_action_provider",
]
