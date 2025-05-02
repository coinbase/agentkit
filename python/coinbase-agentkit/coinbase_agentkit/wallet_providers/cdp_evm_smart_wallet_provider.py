"""CDP EVM Smart Wallet provider."""

import json
import os
import asyncio
from decimal import Decimal
from typing import Any, List

from cdp import CdpClient
from cdp.evm_call_types import EncodedCall
from cdp.evm_transaction_types import TransactionRequestEIP1559
from eth_account.typed_transactions import DynamicFeeTransaction
from pydantic import BaseModel, Field
from web3 import Web3
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from ..__version__ import __version__
from ..network import NETWORK_ID_TO_CHAIN, Network
from .evm_wallet_provider import EvmGasConfig, EvmWalletProvider


class CdpEvmSmartWalletProviderConfig(BaseModel):
    """Configuration options for CDP EVM Smart Wallet provider."""

    api_key_id: str | None = Field(None, description="The CDP API key ID")
    api_key_secret: str | None = Field(None, description="The CDP API secret")
    wallet_secret: str | None = Field(None, description="The CDP wallet secret")
    network_id: str | None = Field(None, description="The network id")
    address: str | None = Field(None, description="The address to use")
    idempotency_key: str | None = Field(None, description="The idempotency key for wallet creation")
    gas: EvmGasConfig | None = Field(None, description="Gas configuration settings")
    paymaster_url: str | None = Field(None, description="Optional paymaster URL for gasless transactions")


class CdpEvmSmartWalletProvider(EvmWalletProvider):
    """A wallet provider that uses the CDP EVM Smart Account SDK."""

    def __init__(self, config: CdpEvmSmartWalletProviderConfig | None = None):
        """Initialize CDP EVM Smart Wallet provider.

        Args:
            config (CdpEvmSmartWalletProviderConfig | None): Configuration options for the CDP provider. If not provided,
                   will attempt to configure from environment variables.

        Raises:
            ValueError: If required configuration is missing or initialization fails
        """
        if not config:
            config = CdpEvmSmartWalletProviderConfig()

        try:
            self._api_key_id = config.api_key_id or os.getenv("CDP_API_KEY_ID")
            self._api_key_secret = config.api_key_secret or os.getenv("CDP_API_KEY_SECRET")
            self._wallet_secret = config.wallet_secret or os.getenv("CDP_WALLET_SECRET")
            self._paymaster_url = config.paymaster_url

            if not self._api_key_id or not self._api_key_secret or not self._wallet_secret:
                raise ValueError(
                    "Missing required environment variables. CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET are required."
                )

            network_id = config.network_id or os.getenv("NETWORK_ID", "base-sepolia")
            self._idempotency_key = config.idempotency_key or os.getenv("IDEMPOTENCY_KEY")

            chain = NETWORK_ID_TO_CHAIN[network_id]
            rpc_url = chain.rpc_urls["default"].http[0]

            self._network = Network(
                protocol_family="evm",
                network_id=network_id,
                chain_id=chain.id,
            )
            self._web3 = Web3(Web3.HTTPProvider(rpc_url))

            # Initialize client and handle account creation/retrieval
            client = self.get_client()
            try:
                async def initialize_accounts():
                    async with client as cdp:
                        if config.address:
                            # If address is provided, get the account
                            # account = await cdp.evm.get_account(address=config.address)
                            # Pass in the account
                            smart_account = await cdp.evm.get_smart_account(owner=account, address=config.address)
                        else:
                            # If no address but idempotency key is provided, create a new account
                            account = await cdp.evm.create_account(idempotency_key=self._idempotency_key)
                            smart_account = await cdp.evm.create_smart_account(owner=account)
                        return account, smart_account

                account, smart_account = asyncio.run(initialize_accounts())
                self._address = smart_account.address
                self._owner_account = account

            finally:
                # Ensure client is properly closed
                asyncio.run(client.close())

            self._gas_limit_multiplier = (
                max(config.gas.gas_limit_multiplier, 1)
                if config and config.gas and config.gas.gas_limit_multiplier is not None
                else 1.2
            )

            self._fee_per_gas_multiplier = (
                max(config.gas.fee_per_gas_multiplier, 1)
                if config and config.gas and config.gas.fee_per_gas_multiplier is not None
                else 1
            )

        except ImportError as e:
            raise ImportError(
                "Failed to import cdp. Please install it with 'pip install cdp-sdk'."
            ) from e
        except Exception as e:
            raise ValueError(f"Failed to initialize CDP smart wallet: {e!s}") from e

    def get_client(self) -> CdpClient:
        """Get a new CDP client instance.

        Returns:
            Cdp: A new CDP client instance
        """
        return CdpClient(
            api_key_id=self._api_key_id,
            api_key_secret=self._api_key_secret,
            wallet_secret=self._wallet_secret,
            debugging=True
        )

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

    def get_address(self) -> str:
        """Get the wallet address.

        Returns:
            str: The wallet's address as a hex string
        """
        return self._address

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
            str: The string 'cdp_evm_smart_wallet_provider'
        """
        return "cdp_evm_smart_wallet_provider"

    def get_network(self) -> Network:
        """Get the current network.

        Returns:
            Network: Network object containing protocol family, network ID, and chain ID
        """
        return self._network

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer the native asset of the network using a user operation.

        Args:
            to (str): The destination address to receive the transfer
            value (Decimal): The amount to transfer in whole units (e.g. 1.5 for 1.5 ETH)

        Returns:
            str: The transaction hash as a string
        """
        value_wei = Web3.to_wei(value, "ether")
        client = self.get_client()

        async def _send_user_operation():
            async with client as cdp:
                user_operation = await cdp.evm.send_user_operation(
                    smart_account=self._address,
                    network=self._network.network_id,
                    calls=[
                        EncodedCall(
                            to=to,
                            value=value_wei,
                            data="0x"
                        )
                    ],
                    paymaster_url=self._paymaster_url
                )
                return await cdp.evm.wait_for_user_operation(
                    smart_account_address=self._address,
                    user_op_hash=user_operation.user_op_hash
                )
        try:
            return self._run_async(_send_user_operation()).transaction_hash
        finally:
            self._run_async(client.close())

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
        """Send a transaction using a user operation.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data

        Returns:
            HexStr: The transaction hash as a hex string
        """
        client = self.get_client()

        async def _send_user_operation():
            async with client as cdp:
                user_operation = await cdp.evm.send_user_operation(
                    smart_account=self._address,
                    network=self._network.network_id,
                    calls=[
                        EncodedCall(
                            to=transaction["to"],
                            value=transaction.get("value", 0),
                            data=transaction.get("data", "0x")
                        )
                    ],
                    paymaster_url=self._paymaster_url
                )
                return await cdp.evm.wait_for_user_operation(
                    smart_account_address=self._address,
                    user_op_hash=user_operation.user_op_hash
                )
        try:
            return self._run_async(_send_user_operation()).transaction_hash
        finally:
            self._run_async(client.close())

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
        message_hash = hash_message(message)
        payload_signature = self._web3.eth.account.sign_message(message_hash, self._owner_account.address)
        return payload_signature.signature

    def sign_typed_data(self, typed_data: dict[str, Any]) -> HexStr:
        """Sign typed data according to EIP-712 standard.

        Args:
            typed_data (dict[str, Any]): The typed data to sign following EIP-712 format

        Returns:
            HexStr: The signature as a hex string
        """
        typed_data_message_hash = hash_typed_data_message(typed_data)
        payload_signature = self._web3.eth.account.sign_message(typed_data_message_hash, self._owner_account.address)
        return payload_signature.signature

    def sign_transaction(self, transaction: TxParams) -> HexStr:
        """Sign an EVM transaction.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data

        Returns:
            HexStr: The transaction signature as a hex string
        """
        dynamic_fee_tx = DynamicFeeTransaction.from_dict(transaction)
        tx_hash_bytes = dynamic_fee_tx.hash()
        tx_hash_hex = tx_hash_bytes.hex()

        payload_signature = self._web3.eth.account.sign_message(tx_hash_hex, self._owner_account.address)
        return payload_signature.signature

    def send_user_operation(self, calls: List[EncodedCall]) -> str:
        """Send a user operation with multiple calls.

        Args:
            calls (List[EncodedCall]): List of encoded calls to execute in the user operation

        Returns:
            str: The transaction hash of the executed user operation
        """
        client = self.get_client()

        async def _send_user_operation():
            async with client as cdp:
                user_operation = await cdp.evm.send_user_operation(
                    smart_account=self._address,
                    network=self._network.network_id,
                    calls=calls,
                    paymaster_url=self._paymaster_url
                )
                return await cdp.evm.wait_for_user_operation(
                    smart_account_address=self._address,
                    user_op_hash=user_operation.user_op_hash
                )
        try:
            return self._run_async(_send_user_operation()).transaction_hash
        finally:
            self._run_async(client.close()) 