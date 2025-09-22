"""CDP API action provider."""

import asyncio
from typing import Any, Literal, TypeVar

from cdp import CdpClient

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import RequestFaucetFundsV2Schema

TWalletProvider = TypeVar("TWalletProvider", bound=WalletProvider)


class CdpApiActionProvider(ActionProvider[TWalletProvider]):
    """CdpApiActionProvider is an action provider for CDP API.

    This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
    """

    def __init__(self):
        """Initialize the CdpApiActionProvider class."""
        super().__init__("cdp_api", [])

    def _is_wallet_provider_with_client(self, wallet_provider: TWalletProvider) -> bool:
        """Check if wallet provider has a CDP client.

        Args:
            wallet_provider: The wallet provider to check.

        Returns:
            bool: True if wallet provider has get_client method.

        """
        return hasattr(wallet_provider, "get_client")

    def _get_client(self, wallet_provider: TWalletProvider) -> CdpClient:
        """Get the CDP client from the wallet provider if it has one.

        Args:
            wallet_provider: The wallet provider to get the client from.

        Returns:
            CdpClient: The CDP client.

        Raises:
            ValueError: If the wallet provider doesn't have a get_client method.

        """
        if not self._is_wallet_provider_with_client(wallet_provider):
            raise ValueError("Wallet provider is not a CDP Wallet Provider.")
        return wallet_provider.get_client()

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
        validated_args = RequestFaucetFundsV2Schema(**args)
        network = wallet_provider.get_network()
        network_id = network.network_id

        if self._is_wallet_provider_with_client(wallet_provider):
            if network.protocol_family == "evm":
                if network_id not in ["base-sepolia", "ethereum-sepolia"]:
                    return "Error: Faucet is only supported on 'base-sepolia' or 'ethereum-sepolia' evm networks."

                token: Literal["eth", "usdc", "eurc", "cbbtc"] = validated_args.asset_id or "eth"

                client = self._get_client(wallet_provider)
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                async def _request_faucet():
                    async with client as cdp:
                        return await cdp.evm.request_faucet(
                            address=wallet_provider.get_address(),
                            token=token,
                            network=network_id,
                        )

                faucet_tx = loop.run_until_complete(_request_faucet())
                return f"Received {validated_args.asset_id or 'ETH'} from the faucet. Transaction hash: {faucet_tx}"
            elif network.protocol_family == "svm":
                if network_id != "solana-devnet":
                    return "Error: Faucet is only supported on 'solana-devnet' solana networks."

                token: Literal["sol", "usdc"] = validated_args.asset_id or "sol"

                client = self._get_client(wallet_provider)
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                async def _request_faucet():
                    async with client as cdp:
                        return await cdp.solana.request_faucet(
                            address=wallet_provider.get_address(),
                            token=token,
                        )

                faucet_tx = loop.run_until_complete(_request_faucet())
                return f"Received {validated_args.asset_id or 'SOL'} from the faucet. Transaction signature hash: {faucet_tx}"
            else:
                return "Error: Faucet is only supported on Ethereum and Solana protocol families."

        else:
            return "Error: Wallet provider is not a CDP Wallet Provider."

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
