"""CDP EVM Server Wallet provider."""

import asyncio
import os
from decimal import Decimal
from typing import Any

from cdp import CdpClient
from cdp.evm_transaction_types import TransactionRequestEIP1559
from pydantic import BaseModel, Field
from web3 import Web3
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from ..network import NETWORK_ID_TO_CHAIN, Network
from .evm_wallet_provider import EvmWalletProvider


class CdpEvmServerProviderConfig(BaseModel):
    """Configuration options for CDP EVM Server providers."""

    api_key_id: str | None = Field(None, description="The CDP API key ID")
    api_key_secret: str | None = Field(None, description="The CDP API secret")
    wallet_secret: str | None = Field(None, description="The CDP wallet secret")


class CdpEvmServerWalletProviderConfig(CdpEvmServerProviderConfig):
    """Configuration options for CDP EVM Server wallet provider."""

    network_id: str | None = Field(None, description="The network id")
    address: str | None = Field(None, description="The address to use")
    idempotency_key: str | None = Field(None, description="The idempotency key for wallet creation")


class CdpEvmServerWalletProvider(EvmWalletProvider):
    """A wallet provider that uses the CDP EVM Server SDK."""

    def __init__(self, config: CdpEvmServerWalletProviderConfig):
        """Initialize CDP EVM Server wallet provider.

        Args:
            config (CdpEvmServerWalletProviderConfig | None): Configuration options for the CDP provider. If not provided,
                   will attempt to configure from environment variables.

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

            network_id = config.network_id or os.getenv("NETWORK_ID", "base-sepolia")
            self._idempotency_key = config.idempotency_key or os.getenv("IDEMPOTENCY_KEY") or None

            chain = NETWORK_ID_TO_CHAIN[network_id]
            rpc_url = chain.rpc_urls["default"].http[0]

            self._network = Network(
                protocol_family="evm",
                network_id=network_id,
                chain_id=chain.id,
            )
            self._web3 = Web3(Web3.HTTPProvider(rpc_url))

            client = self.get_client()
            if config.address:
                account = asyncio.run(self._get_account(client, config.address))
            else:
                account = asyncio.run(self._create_account(client))

            self._account = account

        except Exception as e:
            raise ValueError(f"Failed to initialize CDP wallet: {e!s}") from e

    def get_client(self) -> CdpClient:
        """Get a new CDP client instance.

        Returns:
            Cdp: A new CDP client instance

        """
        return CdpClient(
            api_key_id=self._api_key_id,
            api_key_secret=self._api_key_secret,
            wallet_secret=self._wallet_secret,
        )

    def get_address(self) -> str:
        """Get the wallet address.

        Returns:
            str: The wallet's address as a hex string

        """
        return self._account.address

    def get_balance(self) -> Decimal:
        """Get the wallet balance in native currency.

        Returns:
            Decimal: The wallet's balance in wei as a Decimal

        """
        balance = self._web3.eth.get_balance(self.get_address())
        return Decimal(balance)

    def get_name(self) -> str:
        """Get the name of the wallet provider.

        Returns:
            str: The string 'cdp_evm_server_wallet_provider'

        """
        return "cdp_evm_server_wallet_provider"

    def get_network(self) -> Network:
        """Get the current network.

        Returns:
            Network: Network object containing protocol family, network ID, and chain ID

        """
        return self._network

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer the native asset of the network.

        Args:
            to (str): The destination address to receive the transfer
            value (Decimal): The amount to transfer in whole units (e.g. 1.5 for 1.5 ETH)

        Returns:
            str: The transaction hash as a string

        """
        value_wei = Web3.to_wei(value, "ether")
        client = self.get_client()

        async def _send_transaction():
            async with client as cdp:
                return await cdp.evm.send_transaction(
                    address=self.get_address(),
                    transaction=TransactionRequestEIP1559(
                        to=to,
                        value=value_wei,
                    ),
                    network=self._network.network_id,
                )

        return self._run_async(_send_transaction())

    def read_contract(
        self,
        contract_address: ChecksumAddress,
        abi: list[dict[str, Any]],
        function_name: str,
        args: list[Any] | None = None,
        block_identifier: BlockIdentifier = "latest",
    ) -> Any:
        """Read data from a smart contract.

        Args:
            contract_address (ChecksumAddress): The address of the contract to read from
            abi (list[dict[str, Any]]): The ABI of the contract
            function_name (str): The name of the function to call
            args (list[Any] | None): Arguments to pass to the function call, defaults to empty list
            block_identifier (BlockIdentifier): The block number to read from, defaults to 'latest'

        Returns:
            Any: The result of the contract function call

        """
        contract = self._web3.eth.contract(address=contract_address, abi=abi)
        func = contract.functions[function_name]
        if args is None:
            args = []
        return func(*args).call(block_identifier=block_identifier)

    def send_transaction(self, transaction: TxParams) -> HexStr:
        """Send a transaction to the network.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data

        Returns:
            HexStr: The transaction hash as a hex string

        """
        client = self.get_client()

        async def _send_transaction():
            async with client as cdp:
                return await cdp.evm.send_transaction(
                    address=self.get_address(),
                    transaction=TransactionRequestEIP1559(
                        to=transaction["to"],
                        value=transaction.get("value", 0),
                        data=transaction.get("data", "0x"),
                    ),
                    network=self._network.network_id,
                )

        return self._run_async(_send_transaction())

    def wait_for_transaction_receipt(
        self, tx_hash: HexStr, timeout: float = 120, poll_latency: float = 0.1
    ) -> dict[str, Any]:
        """Wait for transaction confirmation and return receipt.

        Args:
            tx_hash (HexStr): The transaction hash to wait for
            timeout (float): Maximum time to wait in seconds, defaults to 120
            poll_latency (float): Time between polling attempts in seconds, defaults to 0.1

        Returns:
            dict[str, Any]: The transaction receipt as a dictionary

        Raises:
            TimeoutError: If transaction is not mined within timeout period

        """
        return self._web3.eth.wait_for_transaction_receipt(
            tx_hash, timeout=timeout, poll_latency=poll_latency
        )

    def sign_message(self, message: str | bytes) -> HexStr:
        """Sign a message using the wallet's private key.

        Args:
            message (str | bytes): The message to sign, either as a string or bytes

        Returns:
            HexStr: The signature as a hex string

        """
        client = self.get_client()

        async def _sign_message():
            async with client as cdp:
                return await cdp.evm.sign_message(
                    address=self.get_address(),
                    message=message,
                )

        return self._run_async(_sign_message())

    def sign_typed_data(self, typed_data: dict[str, Any]) -> HexStr:
        """Sign typed data according to EIP-712 standard.

        Args:
            typed_data (dict[str, Any]): The typed data to sign following EIP-712 format

        Returns:
            HexStr: The signature as a hex string

        """
        client = self.get_client()

        # Extract required parameters from typed_data
        domain = typed_data.get("domain", {})
        types = typed_data.get("types", {})
        primary_type = typed_data.get("primaryType", "")
        message = typed_data.get("message", {})

        async def _sign_typed_data():
            async with client as cdp:
                return await cdp.evm.sign_typed_data(
                    address=self.get_address(),
                    domain=domain,
                    types=types,
                    primary_type=primary_type,
                    message=message,
                )

        return self._run_async(_sign_typed_data())

    def sign_transaction(self, transaction: TxParams) -> HexStr:
        """Sign an EVM transaction.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data

        Returns:
            HexStr: The transaction signature as a hex string

        """
        client = self.get_client()

        async def _sign_transaction():
            async with client as cdp:
                return await cdp.evm.sign_transaction(
                    address=self.get_address(),
                    transaction=TransactionRequestEIP1559(
                        to=transaction["to"],
                        value=transaction.get("value", 0),
                        data=transaction.get("data", "0x"),
                    ),
                    network=self._network.network_id,
                )

        return self._run_async(_sign_transaction())

    async def _get_account(self, client: CdpClient, address: str):
        """Get an existing account by address.

        Args:
            client (CdpClient): The CDP client instance
            address (str): The address of the account to get

        Returns:
            Any: The account object

        """
        async with client as cdp:
            return await cdp.evm.get_account(address=address)

    async def _create_account(self, client: CdpClient):
        """Create a new account.

        Args:
            client (CdpClient): The CDP client instance

        Returns:
            Any: The newly created account object

        """
        async with client as cdp:
            return await cdp.evm.create_account(idempotency_key=self._idempotency_key)

    def _run_async(self, coroutine):
        """Run an async coroutine synchronously.

        Args:
            coroutine: The coroutine to run

        Returns:
            Any: The result of the coroutine

        """
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coroutine)
