"""CDP API action provider."""

import os
from typing import Any

from cdp import Cdp, ExternalAddress

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ...wallet_providers.cdp_wallet_provider import CdpProviderConfig
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import AddressReputationSchema, RequestFaucetFundsSchema

BASE_SEPOLIA_NETWORK_ID = "base-sepolia"
BASE_SEPOLIA_CHAIN_ID = 84532


class CdpApiActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for interacting with CDP API.

    This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
    """

    def __init__(self, config: CdpProviderConfig | None = None):
        super().__init__("cdp_api", [])

        try:
            api_key_name = config.api_key_name if config else os.getenv("CDP_API_KEY_NAME")
            api_key_private_key = (
                config.api_key_private_key if config else os.getenv("CDP_API_KEY_PRIVATE_KEY")
            )

            if api_key_name and api_key_private_key:
                Cdp.configure(
                    api_key_name=api_key_name,
                    private_key=api_key_private_key.replace("\\n", "\n"),
                )
            else:
                Cdp.configure_from_json()
        except Exception as e:
            raise ValueError(f"Failed to initialize CDP client: {e!s}") from e

    @create_action(
        name="request_faucet_funds",
        description="""
This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
If no asset ID is provided the faucet defaults to ETH. Faucet is only allowed on 'base-sepolia' and can only provide asset ID 'eth' or 'usdc'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.""",
        schema=RequestFaucetFundsSchema,
    )
    def request_faucet_funds(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Request test tokens from the faucet.

        This function requests test tokens from the Base Sepolia faucet for the provided wallet address.
        Only works on Base Sepolia network and only supports ETH and USDC tokens.

        Args:
            wallet_provider (EvmWalletProvider): The wallet provider to get the recipient address from
            args (dict[str, Any]): Arguments containing optional asset_id to request

        Returns:
            str: Success message with transaction details or error message if request fails

        Raises:
            Exception: If faucet request fails for any reason

        """
        validated_args = RequestFaucetFundsSchema(**args)

        try:
            network = wallet_provider.get_network()
            if network.chain_id != BASE_SEPOLIA_CHAIN_ID:
                return "Error: Faucet is only available on base-sepolia network"

            address = ExternalAddress(
                BASE_SEPOLIA_NETWORK_ID,
                wallet_provider.get_address(),
            )

            faucet_tx = address.faucet(validated_args.asset_id)
            faucet_tx.wait()

            asset_str = validated_args.asset_id or "ETH"
            return (
                f"Received {asset_str} from the faucet. Transaction: {faucet_tx.transaction_link}"
            )
        except Exception as e:
            return f"Error requesting faucet funds: {e!s}"

    @create_action(
        name="address_reputation",
        description="""
This tool checks the reputation of an address on a given network. It takes:

- network: The network the address is on (e.g. "base-mainnet")
- address: The Ethereum address to check

Important notes:
- This tool will not work on base-sepolia, you can default to using base-mainnet instead
- The wallet's default address and its network may be used if not provided
""",
        schema=AddressReputationSchema,
    )
    def address_reputation(self, args: dict[str, Any]) -> str:
        """Check the reputation of an Ethereum address on a given network.

        This function checks the reputation score of an Ethereum address on the specified network
        using CDP's reputation service.

        Args:
            args (dict[str, Any]): Arguments containing:
                - network (str): The network to check reputation on (e.g. "base-mainnet")
                - address (str): The Ethereum address to check

        Returns:
            str: A string containing either:
                - The address and its reputation score if successful
                - An error message if the check fails

        Raises:
            Exception: If reputation check fails for any reason

        """
        try:
            validated_args = AddressReputationSchema(**args)

            address = ExternalAddress(validated_args.network, validated_args.address)

            reputation = address.reputation()

            return f"Address {validated_args.address} reputation: {reputation}"
        except Exception as e:
            return f"Error checking address reputation: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Network support will vary action to action."""
        return True


def cdp_api_action_provider(config: CdpProviderConfig | None = None) -> CdpApiActionProvider:
    """Create a new CdpApiActionProvider instance."""
    return CdpApiActionProvider(config=config)
