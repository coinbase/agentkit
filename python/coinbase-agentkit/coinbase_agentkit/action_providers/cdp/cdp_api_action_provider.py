"""CDP API action provider."""

import asyncio
from typing import Any, TypeVar

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .faucet_utils import (
    get_cdp_client,
    handle_evm_faucet,
    handle_svm_faucet,
    validate_network_support,
)
from .schemas import RequestFaucetFundsV2Schema

TWalletProvider = TypeVar("TWalletProvider", bound=WalletProvider)


class CdpApiActionProvider(ActionProvider[TWalletProvider]):
    """CdpApiActionProvider is an action provider for CDP API.

    This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
    """

    def __init__(self):
        """Initialize the CdpApiActionProvider class."""
        super().__init__("cdp_api", [])

    @create_action(
        name="request_faucet_funds",
        description="""This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
Faucet is only allowed on 'base-sepolia' or 'solana-devnet'.
If fauceting on 'base-sepolia', user can only provide asset ID 'eth', 'usdc', 'eurc' or 'cbbtc', if no asset ID is provided, the faucet will default to 'eth'.
If fauceting on 'solana-devnet', user can only provide asset ID 'sol' or 'usdc', if no asset ID is provided, the faucet will default to 'sol'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.""",
        schema=RequestFaucetFundsV2Schema,
    )
    def request_faucet_funds(self, wallet_provider: TWalletProvider, args: dict[str, Any]) -> str:
        """Request test tokens from the faucet for the default address in the wallet.

        Args:
            wallet_provider: The wallet provider to request funds from.
            args: The input arguments for the action.

        Returns:
            A confirmation message with transaction details.

        """
        network = wallet_provider.get_network()
        network_id = network.network_id
        address = wallet_provider.get_address()

        try:
            cdp_client = get_cdp_client(wallet_provider)
            validate_network_support(network, network_id)

            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            if network.protocol_family == "evm":
                return loop.run_until_complete(
                    handle_evm_faucet(cdp_client, address, network_id, args)
                )
            else:  # svm
                return loop.run_until_complete(handle_svm_faucet(cdp_client, address, args))

        except ValueError as e:
            return f"Error: {e}"
        except Exception as e:
            return f"Error requesting faucet funds: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if the CDP action provider supports the given network.

        NOTE: Network scoping is done at the action implementation level

        Args:
            network: The network to check.

        Returns:
            True if the CDP action provider supports the network, false otherwise.

        """
        return True


def cdp_api_action_provider() -> CdpApiActionProvider:
    """Create a new CDP API action provider.

    Returns:
        CdpApiActionProvider: A new CDP API action provider instance.

    """
    return CdpApiActionProvider()
