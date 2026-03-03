"""CDP Solana Wallet provider."""

import asyncio
import os
from decimal import Decimal

from cdp import CdpClient
from pydantic import BaseModel, Field
from solana.rpc.api import Client as SolanaClient
from solders.pubkey import Pubkey as PublicKey

from ..network import Network
from .wallet_provider import WalletProvider


class CdpSolanaWalletProviderConfig(BaseModel):
    """Configuration options for CDP Solana Wallet provider."""

    api_key_id: str | None = Field(None, description="The CDP API key ID")
    api_key_secret: str | None = Field(None, description="The CDP API secret")
    wallet_secret: str | None = Field(None, description="The CDP wallet secret")
    network_id: str | None = Field(None, description="The network id")
    address: str | None = Field(None, description="The wallet address to use")


class CdpSolanaWalletProvider(WalletProvider):
    """A wallet provider that uses the CDP Solana Wallet SDK."""

    def __init__(self, config: CdpSolanaWalletProviderConfig):
        """Initialize CDP Solana Wallet provider.

        Args:
            config (CdpSolanaWalletProviderConfig): Configuration options for the CDP provider.

        Raises:
            ValueError: If required configuration is missing or initialization fails

        """
        try:
            self._api_key_id = config.api_key_id or os.getenv("CDP_API_KEY_ID")
            self._api_key_secret = config.api_key_secret or os.getenv("CDP_API_KEY_SECRET")
            self._wallet_secret = config.wallet_secret or os.getenv("CDP_WALLET_SECRET")

            if not self._api_key_id or not self._api_key_secret or not self._wallet_secret:
                raise ValueError(
                    "Missing required environment variables. CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET are required."
                )

            network_id = config.network_id or os.getenv("NETWORK_ID", "solana-devnet")

            self._network = Network(
                protocol_family="svm",
                network_id=network_id,
                chain_id=None,  # Solana doesn't use chain IDs like EVM
            )

            rpc_url = ""
            if network_id == "solana-devnet":
                rpc_url = "https://api.devnet.solana.com"
            elif network_id == "solana-mainnet":
                rpc_url = "https://api.mainnet-beta.solana.com"
            else:
                rpc_url = "https://api.testnet.solana.com"

            self._connection = SolanaClient(rpc_url)

            # Initialize the wallet with CDP client
            client = self.get_client()
            try:

                async def initialize_wallet():
                    async with client as cdp:
                        if config.address:
                            wallet = await cdp.solana.get_account(address=config.address)
                        else:
                            wallet = await cdp.solana.create_account()
                        return wallet

                wallet = self._run_async(initialize_wallet())
                self._address = wallet.address

            finally:
                self._run_async(client.close())

        except ImportError as e:
            raise ImportError(
                "Failed to import cdp. Please install it with 'pip install cdp-sdk'."
            ) from e
        except Exception as e:
            raise ValueError(f"Failed to initialize CDP Solana wallet: {e!s}") from e

    def get_client(self) -> CdpClient:
        """Get a new CDP client instance.

        Returns:
            CdpClient: A new CDP client instance

        """
        return CdpClient(
            api_key_id=self._api_key_id,
            api_key_secret=self._api_key_secret,
            wallet_secret=self._wallet_secret,
        )

    def _run_async(self, coroutine):
        """Run an async coroutine synchronously.

        Args:
            coroutine: The coroutine to run

        Returns:
            Any: The result of the coroutine

        """
        try:
            # Check if we're in an existing event loop
            loop = asyncio.get_running_loop()
            # If we reach this point, there's already a running event loop
            # We need to run the coroutine in a new thread with a new event loop
            import concurrent.futures

            def run_in_thread():
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    return new_loop.run_until_complete(coroutine)
                finally:
                    new_loop.close()

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_in_thread)
                return future.result()

        except RuntimeError:
            # No running event loop, safe to create and use a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(coroutine)
            finally:
                loop.close()

    def get_address(self) -> str:
        """Get the wallet address.

        Returns:
            str: The wallet's address as a string

        """
        return self._address

    def get_balance(self) -> Decimal:
        """Get the wallet balance in native currency (SOL).

        Returns:
            Decimal: The wallet's balance in lamports as a Decimal

        """
        # Check current balance
        source_pubkey = PublicKey.from_string(self._address)
        balance_resp = self._connection.get_balance(source_pubkey)
        balance = balance_resp.value
        return balance

    def get_name(self) -> str:
        """Get the name of the wallet provider.

        Returns:
            str: The string 'cdp_solana_wallet_provider'

        """
        return "cdp_solana_wallet_provider"

    def get_network(self) -> Network:
        """Get the current network.

        Returns:
            Network: Network object containing protocol family, network ID, and chain ID

        """
        return self._network

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer SOL to another address.

        Args:
            to (str): The destination address to receive the transfer
            value (Decimal): The amount to transfer in SOL

        Returns:
            str: The transaction signature as a string

        """
        client = self.get_client()

        async def _transfer():
            async with client as cdp:
                wallet = await cdp.solana.get_account(address=self._address)
                transaction = await wallet.transfer(
                    to=to,
                    amount=float(value),
                    token="sol",
                    network_id=self._network.network_id,
                )
                return transaction.signature

        try:
            return self._run_async(_transfer())
        finally:
            self._run_async(client.close())

    def sign_message(self, message: str) -> str:
        """Sign a message with the wallet.

        Args:
            message (str): The message to sign

        Returns:
            str: The signature as a string

        """
        client = self.get_client()

        async def _sign_message():
            async with client as cdp:
                signature = await cdp.solana.sign_message(address=self._address, message=message)
                return signature

        try:
            return self._run_async(_sign_message())
        finally:
            self._run_async(client.close())
