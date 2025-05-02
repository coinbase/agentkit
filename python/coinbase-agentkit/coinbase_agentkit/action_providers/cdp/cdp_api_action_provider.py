"""CDP API action provider."""

from typing import Any, Literal
import asyncio

from ...network import Network
from ...wallet_providers.cdp_server_wallet_shared import WalletProviderWithClient
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import RequestFaucetFundsSchema
from cdp import CdpClient


class CdpApiActionProvider(ActionProvider[WalletProviderWithClient]):
    """Provides actions for interacting with CDP API.

    This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
    """

    def __init__(self):
        super().__init__("cdp_api", [])

    @create_action(
        name="request_faucet_funds",
        description="""
This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
Faucet is only allowed on 'base-sepolia' or 'solana-devnet'.
If fauceting on 'base-sepolia', user can only provide asset ID 'eth', 'usdc', 'eurc' or 'cbbtc', if no asset ID is provided, the faucet will default to 'eth'.
If fauceting on 'solana-devnet', user can only provide asset ID 'sol' or 'usdc', if no asset ID is provided, the faucet will default to 'sol'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.""",
        schema=RequestFaucetFundsSchema,
    )
    def request_faucet_funds(
        self, wallet_provider: WalletProviderWithClient, args: dict[str, Any]
    ) -> str:
        """Request test tokens from the faucet.

        Args:
            wallet_provider (WalletProviderWithClient): The wallet provider instance.
            args (dict[str, Any]): Input arguments for the action.

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
            
            async def _request_faucet(cdp):
                return await cdp.evm.request_faucet(
                    address=wallet_provider.get_address(),
                    token=token,
                    network=network_id,
                )
            
            faucet_hash = wallet_provider._run_async(wallet_provider._with_client(_request_faucet))
            return f"Received {validated_args.asset_id or 'ETH'} from the faucet. Transaction hash: {faucet_hash}"
        elif network.protocol_family == "svm":
            if network_id != "solana-devnet":
                return "Error: Faucet is only supported on 'solana-devnet' solana networks."

            token: Literal["sol", "usdc"] = validated_args.asset_id or "sol"
            
            async def _request_faucet(cdp):
                return await cdp.solana.request_faucet(
                    address=wallet_provider.get_address(),
                    token=token,
                )
            
            response = wallet_provider._run_async(wallet_provider._with_client(_request_faucet))
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
