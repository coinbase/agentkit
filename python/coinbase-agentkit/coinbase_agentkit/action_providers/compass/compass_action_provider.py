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
