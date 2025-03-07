"""CDP Wallet provider."""

import json
import os
from decimal import Decimal
from typing import Any

from cdp import (
    Cdp,
    ExternalAddress,
    MnemonicSeedPhrase,
    Wallet,
    WalletData,
    hash_message,
    hash_typed_data_message,
)
from eth_account.typed_transactions import DynamicFeeTransaction
from pydantic import BaseModel, Field
from web3 import Web3
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from ..__version__ import __version__
from ..network import NETWORK_ID_TO_CHAIN, Network
from .evm_wallet_provider import EvmGasConfig, EvmWalletProvider


class CdpProviderConfig(BaseModel):
    """Configuration options for CDP providers."""

    api_key_name: str | None = Field(None, description="The CDP API key name")
    api_key_private_key: str | None = Field(None, description="The CDP API private key")


class CdpWalletProviderConfig(CdpProviderConfig):
    """Configuration options for CDP wallet provider."""

    network_id: str | None = Field(None, description="The network id")
    mnemonic_phrase: str | None = Field(None, description="The mnemonic phrase of the wallet")
    wallet_data: str | None = Field(None, description="The data of the CDP Wallet as a JSON string")
    gas: EvmGasConfig | None = Field(None, description="Gas configuration settings")


class CdpWalletProvider(EvmWalletProvider):
    """A wallet provider that uses the CDP SDK."""

    def __init__(self, config: CdpWalletProviderConfig | None = None):
        """Initialize CDP wallet provider.

        Args:
            config (CdpWalletProviderConfig | None): Configuration options for the CDP provider. If not provided,
                   will attempt to configure from environment variables.

        Raises:
            ValueError: If required configuration is missing or initialization fails

        """
        if not config:
            config = CdpWalletProviderConfig()

        try:
            api_key_name = config.api_key_name or os.getenv("CDP_API_KEY_NAME")
            api_key_private_key = config.api_key_private_key or os.getenv("CDP_API_KEY_PRIVATE_KEY")

            if api_key_name and api_key_private_key:
                Cdp.configure(
                    api_key_name=api_key_name,
                    private_key=api_key_private_key.replace("\\n", "\n"),
                    source="agentkit",
                    source_version=__version__,
                )
            else:
                Cdp.configure_from_json(source="agentkit", source_version=__version__)

            network_id = config.network_id or os.getenv("NETWORK_ID", "base-sepolia")

            if config.wallet_data:
                wallet_data = WalletData.from_dict(json.loads(config.wallet_data))

                wallet = Wallet.import_data(wallet_data)
                network_id = wallet.network_id

                self._wallet = wallet
            elif config.mnemonic_phrase:
                phrase = MnemonicSeedPhrase(config.mnemonic_phrase)
                self._wallet = Wallet.import_wallet(phrase, network_id)
            else:
                self._wallet = Wallet.create(network_id=network_id)

            chain = NETWORK_ID_TO_CHAIN[network_id]
            rpc_url = chain.rpc_urls["default"].http[0]

            self._address = self._wallet.default_address.address_id
            self._network = Network(
                protocol_family="evm",
                network_id=network_id,
                chain_id=chain.id,
            )
            self._web3 = Web3(Web3.HTTPProvider(rpc_url))

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

        Raises:
            Exception: If wallet is not initialized

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        balance = self._wallet.balance("eth")
        return Decimal(str(Web3.to_wei(balance, "ether")))

    def get_name(self) -> str:
        """Get the name of the wallet provider.

        Returns:
            str: The string 'cdp_wallet_provider'

        """
        return "cdp_wallet_provider"

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

        Raises:
            Exception: If transfer fails or wallet is not initialized

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        try:
            transfer_result = self._wallet.transfer(
                amount=value,
                asset_id="eth",
                destination=Web3.to_checksum_address(to),
                gasless=False,
            )

            transfer_result.wait()
            tx_hash = transfer_result.transaction_hash

            if not tx_hash:
                raise Exception("Transaction hash not found")

            return tx_hash
        except Exception as e:
            raise Exception(f"Failed to transfer native tokens: {e!s}") from e

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

        Raises:
            Exception: If the contract call fails or wallet is not initialized

        """
        contract = self._web3.eth.contract(address=contract_address, abi=abi)
        func = contract.functions[function_name]
        if args is None:
            args = []
        return func(*args).call(block_identifier=block_identifier)

    def sign_message(self, message: str | bytes) -> HexStr:
        """Sign a message using the wallet's private key.

        Args:
            message (str | bytes): The message to sign, either as a string or bytes

        Returns:
            HexStr: The signature as a hex string

        Raises:
            Exception: If the wallet is not initialized or signing fails

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        message_hash = hash_message(message)
        payload_signature = self._wallet.sign_payload(message_hash)

        return payload_signature.signature

    def sign_typed_data(self, typed_data: dict[str, Any]) -> HexStr:
        """Sign typed data according to EIP-712 standard.

        Args:
            typed_data (dict[str, Any]): The typed data to sign following EIP-712 format

        Returns:
            HexStr: The signature as a hex string

        Raises:
            Exception: If the wallet is not initialized or signing fails

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        typed_data_message_hash = hash_typed_data_message(typed_data)

        payload_signature = self._wallet.sign_payload(typed_data_message_hash)

        return payload_signature.signature

    def sign_transaction(self, transaction: TxParams) -> HexStr:
        """Sign an EVM transaction.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data

        Returns:
            HexStr: The transaction signature as a hex string

        Raises:
            Exception: If wallet is not initialized or signing fails

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        dynamic_fee_tx = DynamicFeeTransaction.from_dict(transaction)

        tx_hash_bytes = dynamic_fee_tx.hash()
        tx_hash_hex = tx_hash_bytes.hex()

        payload_signature = self._wallet.sign_payload(tx_hash_hex)
        return payload_signature.signature

    def send_transaction(self, transaction: TxParams) -> HexStr:
        """Send a signed transaction to the network.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data

        Returns:
            HexStr: The transaction hash as a hex string

        Raises:
            Exception: If transaction preparation or sending fails

        """
        self._prepare_transaction(transaction)

        signature = self.sign_transaction(transaction)

        transaction["r"] = int(signature[2:66], 16)
        transaction["s"] = int(signature[66:130], 16)
        transaction["v"] = int(signature[130:132], 16) - 27

        signed_dynamic_fee_tx = DynamicFeeTransaction.from_dict(transaction)

        signed_bytes = signed_dynamic_fee_tx.payload()

        external_address = ExternalAddress(
            self._wallet.network_id, self._wallet.default_address.address_id
        )
        broadcasted_transaction = external_address.broadcast_external_transaction(
            "02" + signed_bytes.hex()
        )

        return broadcasted_transaction.transaction_hash

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

    def _prepare_transaction(self, transaction: TxParams) -> TxParams:
        """Prepare EIP-1559 transaction for signing.

        Args:
            transaction (TxParams): Raw transaction parameters

        Returns:
            TxParams: Transaction parameters with gas estimation and fee calculation

        Raises:
            Exception: If transaction preparation fails

        """
        if transaction["to"]:
            transaction["to"] = Web3.to_bytes(hexstr=transaction["to"])
        else:
            transaction["to"] = b""

        transaction["from"] = self._address
        transaction["value"] = int(transaction.get("value", 0))
        transaction["type"] = 2
        transaction["chainId"] = int(self._network.chain_id)

        nonce = self._web3.eth.get_transaction_count(self._address)
        transaction["nonce"] = nonce

        data_field = transaction.get("data", b"")
        if isinstance(data_field, str) and data_field.startswith("0x"):
            data_bytes = bytes.fromhex(data_field[2:])

        transaction["data"] = data_bytes

        max_priority_fee_per_gas, max_fee_per_gas = self._estimate_fees()
        transaction["maxPriorityFeePerGas"] = max_priority_fee_per_gas
        transaction["maxFeePerGas"] = max_fee_per_gas

        gas = int(self._web3.eth.estimate_gas(transaction) * self._gas_limit_multiplier)
        transaction["gas"] = gas

        del transaction["from"]

        return transaction

    def _estimate_fees(self):
        """Estimate gas fees for a transaction, applying the configured fee multipliers.

        Returns:
            tuple[int, int]: Tuple of (max_priority_fee_per_gas, max_fee_per_gas) in wei

        """

        def get_base_fee():
            latest_block = self._web3.eth.get_block("latest")
            base_fee = latest_block["baseFeePerGas"]
            # Multiply the configured fee multiplier to give some buffer
            return int(base_fee * self._fee_per_gas_multiplier)

        def get_max_priority_fee():
            max_priority_fee_per_gas = Web3.to_wei(0.1, "gwei")
            # Multiply the configured fee multiplier to give some buffer
            return int(max_priority_fee_per_gas * self._fee_per_gas_multiplier)

        base_fee_per_gas = get_base_fee()
        max_priority_fee_per_gas = get_max_priority_fee()
        max_fee_per_gas = base_fee_per_gas + max_priority_fee_per_gas

        return (max_priority_fee_per_gas, max_fee_per_gas)

    def export_wallet(self) -> WalletData:
        """Export the wallet data for persistence.

        Returns:
            WalletData: The wallet data object containing all necessary information

        Raises:
            Exception: If wallet is not initialized

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        return self._wallet.export_data()

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

        Raises:
            Exception: If wallet is not initialized or deployment fails

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        try:
            return self._wallet.deploy_contract(
                solidity_version=solidity_version,
                solidity_input_json=solidity_input_json,
                contract_name=contract_name,
                constructor_args=constructor_args,
            )
        except Exception as e:
            raise Exception(f"Failed to deploy contract: {e!s}") from e

    def deploy_nft(self, name: str, symbol: str, base_uri: str) -> Any:
        """Deploy a new NFT (ERC-721) smart contract.

        Args:
            name (str): The name of the NFT collection
            symbol (str): The token symbol for the collection
            base_uri (str): The base URI for token metadata

        Returns:
            Any: The deployed NFT contract instance

        Raises:
            Exception: If wallet is not initialized or deployment fails

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        try:
            return self._wallet.deploy_nft(
                name=name,
                symbol=symbol,
                base_uri=base_uri,
            )
        except Exception as e:
            raise Exception(f"Failed to deploy NFT: {e!s}") from e

    def deploy_token(self, name: str, symbol: str, total_supply: str) -> Any:
        """Deploy an ERC20 token contract.

        Args:
            name (str): The name of the token
            symbol (str): The symbol of the token
            total_supply (str): The total supply of the token

        Returns:
            Any: The deployed token contract instance

        Raises:
            Exception: If wallet is not initialized or deployment fails

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        try:
            return self._wallet.deploy_token(
                name=name,
                symbol=symbol,
                total_supply=total_supply,
            )
        except Exception as e:
            raise Exception(f"Failed to deploy token: {e!s}") from e

    def trade(self, amount: str, from_asset_id: str, to_asset_id: str) -> str:
        """Trade a specified amount of one asset for another.

        Args:
            amount (str): The amount of the from asset to trade, e.g. `15`, `0.000001`.
            from_asset_id (str): The from asset ID to trade (e.g., "eth", "usdc", or a valid contract address).
            to_asset_id (str): The to asset ID to trade (e.g., "eth", "usdc", or a valid contract address).

        Returns:
            str: A message containing the trade details and transaction information

        Raises:
            Exception: If trade fails or wallet is not initialized

        """
        if not self._wallet:
            raise Exception("Wallet not initialized")

        try:
            trade_result = self._wallet.trade(
                amount=amount,
                from_asset_id=from_asset_id,
                to_asset_id=to_asset_id,
            ).wait()

            return "\n".join(
                [
                    f"Traded {amount} of {from_asset_id} for {trade_result.to_amount} of {to_asset_id}.",
                    f"Transaction hash for the trade: {trade_result.transaction.transaction_hash}",
                    f"Transaction link for the trade: {trade_result.transaction.transaction_link}",
                ]
            )
        except Exception as e:
            raise Exception(f"Error trading assets: {e!s}") from e
