"""CDP EVM Server Wallet provider."""

import json
import os
import asyncio
from decimal import Decimal
from typing import Any

from cdp import CdpClient
from cdp.evm_transaction_types import TransactionRequestEIP1559
from eth_account.typed_transactions import DynamicFeeTransaction
from pydantic import BaseModel, Field
from web3 import Web3
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from ..__version__ import __version__
from ..network import NETWORK_ID_TO_CHAIN, Network
from .evm_wallet_provider import EvmGasConfig, EvmWalletProvider


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
    gas: EvmGasConfig | None = Field(None, description="Gas configuration settings")


class CdpEvmServerWalletProvider(EvmWalletProvider):
    """A wallet provider that uses the CDP EVM Server SDK."""

    def __init__(self, config: CdpEvmServerWalletProviderConfig | None = None):
        """Initialize CDP EVM Server wallet provider.

        Args:
            config (CdpEvmServerWalletProviderConfig | None): Configuration options for the CDP provider. If not provided,
                   will attempt to configure from environment variables.

        Raises:
            ValueError: If required configuration is missing or initialization fails
        """
        if not config:
            config = CdpEvmServerWalletProviderConfig()

        try:
            self._api_key_id = config.api_key_id or os.getenv("CDP_API_KEY_ID")
            self._api_key_secret = config.api_key_secret or os.getenv("CDP_API_KEY_SECRET")
            self._wallet_secret = config.wallet_secret or os.getenv("CDP_WALLET_SECRET")

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
            if config.address:
                # If address is provided, get the account
                account = asyncio.run(self._get_account(client, config.address))
            else:
                # If no address but idempotency key is provided, create a new account
                account = asyncio.run(self._create_account(client))
            
            self._address = account.address

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
            raise ValueError(f"Failed to initialize CDP wallet: {e!s}") from e

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

    def _run_async(self, coroutine):
        """Run an async coroutine synchronously and ensure proper cleanup.

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
        
        try:
            return loop.run_until_complete(coroutine)
        finally:
            # Clean up any pending tasks
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

    async def _with_client(self, operation):
        """Execute an operation with a client, ensuring proper cleanup.

        Args:
            operation: An async function that takes a client as its argument

        Returns:
            Any: The result of the operation
        """
        client = self.get_client()
        try:
            async with client as cdp:
                result = await operation(cdp)
                # Ensure the client's session is closed before returning
                if hasattr(client, '_session') and client._session:
                    await client._session.close()
                return result
        except Exception as e:
            # Ensure the client's session is closed even if an error occurs
            if hasattr(client, '_session') and client._session:
                await client._session.close()
            raise e

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

        async def _send_transaction(cdp):
            return await cdp.evm.send_transaction(
                address=self.get_address(),
                transaction=TransactionRequestEIP1559(
                    to=to,
                    value=value_wei,
                ),
                network=self._network.network_id,
            )
        return self._run_async(self._with_client(_send_transaction))

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
        async def _send_transaction(cdp):
            return await cdp.evm.send_transaction(
                address=self.get_address(),
                transaction=TransactionRequestEIP1559(
                    to=transaction["to"],
                    value=transaction.get("value", 0),
                    data=transaction.get("data", "0x"),
                ),
                network=self._network.network_id,
            )
        return self._run_async(self._with_client(_send_transaction))

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
        payload_signature = self._web3.eth.account.sign_message(message_hash, self.get_address())
        return payload_signature.signature

    def sign_typed_data(self, typed_data: dict[str, Any]) -> HexStr:
        """Sign typed data according to EIP-712 standard.

        Args:
            typed_data (dict[str, Any]): The typed data to sign following EIP-712 format

        Returns:
            HexStr: The signature as a hex string
        """
        typed_data_message_hash = hash_typed_data_message(typed_data)
        payload_signature = self._web3.eth.account.sign_message(typed_data_message_hash, self.get_address())
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

        payload_signature = self._web3.eth.account.sign_message(tx_hash_hex, self.get_address())
        return payload_signature.signature

    def deploy_contract(
        self,
        solidity_version: str,
        solidity_input_json: str,
        contract_name: str,
        constructor_args: dict[str, Any],
    ) -> Any:
        """Deploy a smart contract.

        Args:
            solidity_version (str): The version of the Solidity compiler to use
            solidity_input_json (str): The JSON input for the Solidity compiler
            contract_name (str): The name of the contract to deploy
            constructor_args (dict[str, Any]): Key-value map of constructor arguments

        Returns:
            Any: The deployed contract instance
        """
        async def _deploy_contract(cdp):
            return await cdp.evm.deploy_contract(
                solidity_version=solidity_version,
                solidity_input_json=solidity_input_json,
                contract_name=contract_name,
                constructor_args=constructor_args,
            )
        return self._run_async(self._with_client(_deploy_contract))

    def deploy_nft(self, name: str, symbol: str, base_uri: str) -> Any:
        """Deploy a new NFT (ERC-721) smart contract.

        Args:
            name (str): The name of the NFT collection
            symbol (str): The token symbol for the collection
            base_uri (str): The base URI for token metadata

        Returns:
            Any: The deployed NFT contract instance
        """
        async def _deploy_nft(cdp):
            return await cdp.evm.deploy_nft(
                name=name,
                symbol=symbol,
                base_uri=base_uri,
            )
        return self._run_async(self._with_client(_deploy_nft))

    def deploy_token(self, name: str, symbol: str, total_supply: str) -> Any:
        """Deploy an ERC20 token contract.

        Args:
            name (str): The name of the token
            symbol (str): The symbol of the token
            total_supply (str): The total supply of the token

        Returns:
            Any: The deployed token contract instance
        """
        async def _deploy_token(cdp):
            return await cdp.evm.deploy_token(
                name=name,
                symbol=symbol,
                total_supply=total_supply,
            )
        return self._run_async(self._with_client(_deploy_token))

    def trade(self, amount: str, from_asset_id: str, to_asset_id: str) -> str:
        """Trade a specified amount of one asset for another.

        Args:
            amount (str): The amount of the from asset to trade, e.g. `15`, `0.000001`.
            from_asset_id (str): The from asset ID to trade (e.g., "eth", "usdc", or a valid contract address).
            to_asset_id (str): The to asset ID to trade (e.g., "eth", "usdc", or a valid contract address).

        Returns:
            str: A message containing the trade details and transaction information
        """
        async def _trade(cdp):
            trade_result = await cdp.evm.trade(
                amount=amount,
                from_asset_id=from_asset_id,
                to_asset_id=to_asset_id,
            )
            return "\n".join(
                [
                    f"Traded {amount} of {from_asset_id} for {trade_result.to_amount} of {to_asset_id}.",
                    f"Transaction hash for the trade: {trade_result.transaction_hash}",
                    f"Transaction link for the trade: {trade_result.transaction_link}",
                ]
            )
        return self._run_async(self._with_client(_trade))
