"""Wallet action provider for basic wallet operations."""

from decimal import Decimal
from typing import Any

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetBalanceSchema, GetWalletDetailsSchema, NativeTransferSchema

# Protocol-specific terminology for displaying balances and transactions
PROTOCOL_FAMILY_TO_TERMINOLOGY = {
    "evm": {
        "unit": "WEI",
        "display_unit": "ETH",
        "decimals": 18,
        "type": "Transaction hash",
        "verb": "transaction",
    },
    "svm": {
        "unit": "LAMPORTS",
        "display_unit": "SOL",
        "decimals": 9,
        "type": "Signature",
        "verb": "transfer",
    },
}

DEFAULT_TERMINOLOGY = {
    "unit": "",
    "display_unit": "",
    "decimals": 0,
    "type": "Hash",
    "verb": "transfer",
}


class WalletActionProvider(ActionProvider[WalletProvider]):
    """Provides actions for interacting with wallet functionality."""

    def __init__(self):
        super().__init__("wallet", [])

    @create_action(
        name="get_wallet_details",
        description="""
    This tool will return the details of the connected wallet including:
    - Wallet address
    - Network information (protocol family, network ID, chain ID)
    - Native token balance (ETH for EVM networks, SOL for SVM networks)
    - Wallet provider name
    """,
        schema=GetWalletDetailsSchema,
    )
    def get_wallet_details(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Get details about the connected wallet.

        Args:
            wallet_provider (WalletProvider): The wallet provider to get details from.
            args (dict[str, Any]): The input arguments.

        Returns:
            str: A formatted string containing wallet details and network information.

        """
        try:
            wallet_address = wallet_provider.get_address()
            network = wallet_provider.get_network()
            balance = wallet_provider.get_balance()
            provider_name = wallet_provider.get_name()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )

            # Format balance in whole units
            formatted_balance = str(Decimal(balance) / (10 ** terminology["decimals"]))

            return f"""Wallet Details:
- Provider: {provider_name}
- Address: {wallet_address}
- Network:
  * Protocol Family: {network.protocol_family}
  * Network ID: {network.network_id or "N/A"}
  * Chain ID: {network.chain_id if network.chain_id else "N/A"}
- Native Balance: {balance} {terminology["unit"]}
- Native Balance: {formatted_balance} {terminology["display_unit"]}"""
        except Exception as e:
            return f"Error getting wallet details: {e}"

    @create_action(
        name="get_balance",
        description="This tool will get the native currency balance of the connected wallet.",
        schema=GetBalanceSchema,
    )
    def get_balance(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Get the native currency balance for the connected wallet.

        Args:
            wallet_provider (WalletProvider): The wallet provider to get the balance from.
            args (dict[str, Any]): The input arguments.

        Returns:
            str: A message containing the wallet address and balance information.

        """
        try:
            balance = wallet_provider.get_balance()
            wallet_address = wallet_provider.get_address()

            return f"Native balance at address {wallet_address}: {balance}"
        except Exception as e:
            return f"Error getting balance: {e}"

    @create_action(
        name="native_transfer",
        description="""
This tool will transfer native tokens (ETH for EVM networks, SOL for SVM networks) from the wallet to another onchain address.

It takes the following inputs:
- to: The destination address to receive the funds
- value: The amount to transfer in whole units (e.g. '4.2' for 4.2 ETH, '0.1' for 0.1 SOL)

Important notes:
- Ensure sufficient balance of the input asset before transferring
- Ensure there is sufficient balance for the transfer itself AND the gas cost of this transfer
""",
        schema=NativeTransferSchema,
    )
    def native_transfer(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Transfer native tokens from the connected wallet to a destination address.

        Args:
            wallet_provider (WalletProvider): The wallet provider to transfer tokens from.
            args (dict[str, Any]): Arguments containing destination address and transfer amount.

        Returns:
            str: A message containing the transfer details and transaction hash.

        """
        try:
            validated_args = NativeTransferSchema(**args)
            network = wallet_provider.get_network()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )

            # Convert string to Decimal for wallet provider
            value_decimal = Decimal(validated_args.value)

            tx_hash = wallet_provider.native_transfer(validated_args.to, value_decimal)
            return f"Transferred {validated_args.value} {terminology['display_unit']} to {validated_args.to}\n{terminology['type']}: {tx_hash}"
        except Exception as e:
            network = wallet_provider.get_network()
            terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY.get(
                network.protocol_family, DEFAULT_TERMINOLOGY
            )
            return f"Error during {terminology['verb']}: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by wallet actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: True if the network is supported.

        """
        return True


def wallet_action_provider() -> WalletActionProvider:
    """Create a new WalletActionProvider instance.

    Returns:
        WalletActionProvider: A new wallet action provider instance.

    """
    return WalletActionProvider()
