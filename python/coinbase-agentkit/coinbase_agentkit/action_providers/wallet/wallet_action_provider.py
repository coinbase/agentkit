"""Wallet action provider for basic wallet operations."""

from typing import Any

from ...network import Network
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetBalanceSchema, GetWalletDetailsSchema, NativeTransferSchema


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
    - Native token balance
    - Wallet provider name
    """,
        schema=GetWalletDetailsSchema,
    )
    def get_wallet_details(
        self, wallet_provider: WalletProvider, args: GetWalletDetailsSchema
    ) -> str:
        """Get details about the connected wallet.

        This function retrieves various details about the connected wallet including its address,
        network information, native token balance, and provider name.

        Args:
            wallet_provider (WalletProvider): The wallet provider to get details from
            args (GetWalletDetailsSchema): The input arguments (unused in this function)

        Returns:
            str: A formatted string containing:
                - Wallet provider name
                - Wallet address
                - Network details (protocol family, network ID, chain ID)
                - Native token balance

        Raises:
            Exception: If retrieving any wallet details fails

        """
        """Get details about the wallet."""
        try:
            wallet_address = wallet_provider.get_address()
            network = wallet_provider.get_network()
            balance = wallet_provider.get_balance()
            provider_name = wallet_provider.get_name()

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

    @create_action(
        name="get_balance",
        description="This tool will get the native currency balance of the connected wallet.",
        schema=GetBalanceSchema,
    )
    def get_balance(self, wallet_provider: WalletProvider, args: GetBalanceSchema) -> str:
        """Get the native currency balance for the connected wallet.

        This function retrieves the native token balance and address of the connected wallet.

        Args:
            wallet_provider (WalletProvider): The wallet provider to get the balance from
            args (GetBalanceSchema): The input arguments (unused in this function)

        Returns:
            str: A message containing either:
                - The wallet address and its native token balance if successful
                - An error message if retrieving the balance fails

        Raises:
            Exception: If retrieving the wallet balance fails for any reason

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
This tool will transfer native tokens from the wallet to another onchain address.

It takes the following inputs:
- to: The destination address to receive the funds (e.g. '0x5154eae861cac3aa757d6016babaf972341354cf')
- value: The amount to transfer in whole units (e.g. '1.5' for 1.5 ETH)

Important notes:
- Ensure sufficient balance of the input asset before transferring
- Ensure there is sufficient balance for the transfer itself AND the gas cost of this transfer
""",
        schema=NativeTransferSchema,
    )
    def native_transfer(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Transfer native tokens from the connected wallet to a destination address.

        This function transfers native tokens from the connected wallet to a specified
        destination address by calling the wallet provider's native_transfer method.

        Args:
            wallet_provider (WalletProvider): The wallet provider to transfer tokens from,
                used to sign and send the transaction
            args (dict[str, Any]): Arguments containing:
                - to (str): The destination address to receive the tokens
                - value (str): The amount of tokens to transfer in whole units

        Returns:
            str: A message containing either:
                - The transfer details and transaction hash if successful
                - An error message if the transfer fails

        Raises:
            Exception: If the transfer transaction fails for any reason

        """
        try:
            validated_args = NativeTransferSchema(**args)
            tx_hash = wallet_provider.native_transfer(validated_args.to, validated_args.value)
            return f"Successfully transferred {validated_args.value} native tokens to {validated_args.to}.\nTransaction hash: {tx_hash}"
        except Exception as e:
            return f"Error transferring native tokens: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by wallet actions."""
        return True


def wallet_action_provider() -> WalletActionProvider:
    """Create a new WalletActionProvider instance."""
    return WalletActionProvider()
