"""CDP API action provider."""

import asyncio
from typing import Any, Literal, TypeVar

from cdp import CdpClient

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import RequestFaucetFundsSchema

TWalletProvider = TypeVar("TWalletProvider", bound=EvmWalletProvider)


class CdpApiActionProvider(ActionProvider[TWalletProvider]):
    """Provides actions for interacting with CDP API.

    This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
    """

    def __init__(self):
        super().__init__("cdp_api", [])

    def _get_client(self, wallet_provider: TWalletProvider) -> CdpClient:
        """Get the CDP client from the wallet provider if it has one.

        Args:
            wallet_provider: The wallet provider to get the client from.

        Returns:
            CdpClient: The CDP client.

        Raises:
            AttributeError: If the wallet provider doesn't have a get_client method.

        """
        if not hasattr(wallet_provider, "get_client"):
            raise AttributeError(
                "Wallet provider must have a get_client method to use CDP API actions"
            )
        return wallet_provider.get_client()

    @create_action(
        name="request_faucet_funds",
        description="""
This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
Faucet is only allowed on 'base-sepolia', 'ethereum-sepolia' or 'solana-devnet'.
If fauceting on 'base-sepolia' or 'ethereum-sepolia', user can only provide asset ID 'eth', 'usdc', 'eurc' or 'cbbtc', if no asset ID is provided, the faucet will default to 'eth'.
If fauceting on 'solana-devnet', user can only provide asset ID 'sol' or 'usdc', if no asset ID is provided, the faucet will default to 'sol'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.""",
        schema=RequestFaucetFundsSchema,
    )
    def request_faucet_funds(self, wallet_provider: TWalletProvider, args: dict[str, Any]) -> str:
        """Request test tokens from the faucet.

        Args:
            wallet_provider: The wallet provider instance.
            args: Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = RequestFaucetFundsSchema(**args)
        network = wallet_provider.get_network()
        network_id = network.network_id

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

            faucet_hash = loop.run_until_complete(_request_faucet())
            return f"Received {validated_args.asset_id or 'ETH'} from the faucet. Transaction hash: {faucet_hash}"
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

            response = loop.run_until_complete(_request_faucet())
            return f"Received {validated_args.asset_id or 'SOL'} from the faucet. Transaction signature hash: {response.transaction_signature}"
        else:
            return "Error: Faucet is only supported on Ethereum and Solana protocol families."

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        if network.protocol_family == "evm":
            return network.network_id in ["base-sepolia", "ethereum-sepolia"]
        elif network.protocol_family == "svm":
            return network.network_id == "solana-devnet"
        return False


def cdp_api_action_provider() -> CdpApiActionProvider:
    """Create a new CDP API action provider.

    Returns:
        CdpApiActionProvider: A new CDP API action provider instance.

    """
    return CdpApiActionProvider()
