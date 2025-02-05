from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import CreateAction
from ..action_provider import ActionProvider


class GetWalletDetailsSchema(BaseModel):
    """Input schema for getting wallet details."""

    pass


class GetBalanceSchema(BaseModel):
    """Input schema for getting wallet balance."""

    asset_id: str = Field(..., description="The asset ID to get the balance for (e.g. 'eth' for native ETH)")


class WalletActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for interacting with wallet functionality."""

    def __init__(self):
        super().__init__("wallet", [])

    @CreateAction(
        name="get_wallet_details",
        description="""
    This tool will return the details of the connected wallet including:
    - Wallet address
    - Network information (protocol family, network ID, chain ID)
    - Native token balance
    - Wallet provider name
    """,
        schema=GetWalletDetailsSchema
    )
    def get_wallet_details(
        self,
        args: dict[str, Any]
    ) -> str:
        """Get details about the wallet."""
        try:
            wallet_address = self.wallet_provider.get_address()
            network = self.wallet_provider.get_network()
            balance = self.wallet_provider.get_balance()
            provider_name = self.wallet_provider.get_name()

            return f"""Wallet Details:
- Provider: {provider_name}
- Address: {wallet_address}
- Network:
  * Protocol Family: {network.protocol_family}
  * Network ID: {network.network_id or "N/A"}
  * Chain ID: {str(network.chain_id) if network.chain_id else "N/A"}
- Native Balance: {balance}"""
        except Exception as e:
            return f"Error getting wallet details: {e}"

    @CreateAction(
        name="get_balance",
        description="""
    This tool will get the balance of the connected wallet for a given asset.
    It takes the asset ID as input. Use 'eth' for the native asset ETH.
    """,
        schema=GetBalanceSchema
    )
    def get_balance(
        self,
        args: dict[str, Any]
    ) -> str:
        """Get balance for the wallet for a given asset."""
        try:
            asset_id = args["asset_id"]
            balance = self.wallet_provider.get_balance()
            wallet_address = self.wallet_provider.get_address()
            
            return f"Balance for {asset_id.upper()} at address {wallet_address}: {balance} WEI"
        except Exception as e:
            return f"Error getting balance: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by wallet actions."""
        return True

def wallet_action_provider() -> WalletActionProvider:
    """Create a new WalletActionProvider instance."""
    return WalletActionProvider()
