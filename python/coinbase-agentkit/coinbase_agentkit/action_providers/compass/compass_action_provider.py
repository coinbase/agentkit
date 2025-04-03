from langchain_compass.toolkits import LangchainCompassToolkit

from coinbase_agentkit.action_providers.action_provider import (
    Action,
    ActionProvider,
    TWalletProvider,
)
from coinbase_agentkit.network import (
    CHAIN_ID_TO_NETWORK_ID,
    NETWORK_ID_TO_CHAIN,
    Network,
    arbitrum,
    base,
    mainnet,
)
from coinbase_agentkit.wallet_providers import EvmWalletProvider

SUPPORTED_NETWORKS = [base, arbitrum, mainnet]


class CompassActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with Morpho Vaults."""

    def __init__(self):
        super().__init__("compass", [])

    def get_actions(self, wallet_provider: TWalletProvider) -> list[Action]:
        """Get all Compass actions."""
        return LangchainCompassToolkit().get_tools()

    def supports_network(self, network: Network) -> bool:
        """Check if this provider supports the given network."""
        if network.chain_id is None:
            network.network_id = CHAIN_ID_TO_NETWORK_ID[network.chain_id]
        if network.network_id:
            return NETWORK_ID_TO_CHAIN[network.network_id] in [base, arbitrum, mainnet]
        return False


def compass_action_provider() -> CompassActionProvider:
    """Create a new Compass action provider.

    Returns:
        MorphoActionProvider: A new Morpho action provider instance.

    """
    return CompassActionProvider()


# if __name__ == "__main__":
#     from dotenv import load_dotenv
#     load_dotenv()
#     from coinbase_agentkit.wallet_providers import (
#         CdpWalletProvider,
#         CdpWalletProviderConfig,
#         EthAccountWalletProvider,
#         EthAccountWalletProviderConfig,
#         EvmWalletProvider,
#         SmartWalletProvider,
#         SmartWalletProviderConfig,
#         WalletProvider,
#     )
#     provider = CompassActionProvider()
#     # from eth_account.account import LocalAccount
#     # from eth_keys.datatypes import (
#     #     PrivateKey,
#     # )
#     # from eth_account.account_local_actions import (
#     #     AccountLocalActions,
#     # )
#     # account = LocalAccount(key=PrivateKey(b'\x1f\xd3\x91\x9c\xb4z\x99\xcb\xd3\xf6\x1e\xa3\x12\xb4v\x1e\x81\x84\xe5\x8fF\xb3\xf4\xd6t\xc5\xb4\x1aQ\xc7\x92a'), account=AccountLocalActions())
#
#
#     with open('wallet_data.txt') as f:
#         wallet_data = f.read()
#
#     print("wallet_data", wallet_data)
#     cdp_config = None
#     if wallet_data is not None:
#         cdp_config = CdpWalletProviderConfig(wallet_data=wallet_data)
#     else:
#         assert 1==2
#
#     wallet_provider = CdpWalletProvider(cdp_config)
#
#     actions = provider.get_actions(
#             wallet_provider=wallet_provider
#     )
#     print(actions)
#     print(provider)
