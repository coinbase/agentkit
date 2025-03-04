"""Eth account wallet provider."""

from decimal import Decimal
from typing import Any

from eth_account.account import LocalAccount
from eth_account.datastructures import SignedTransaction
from eth_account.messages import encode_defunct
from pydantic import BaseModel, Field
from web3 import Web3
from web3.middleware import SignAndSendRawMiddlewareBuilder
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from ..network import CHAIN_ID_TO_NETWORK_ID, NETWORK_ID_TO_CHAIN, Network
from .evm_wallet_provider import EvmGasConfig, EvmWalletProvider


class EthAccountWalletProviderConfig(BaseModel):
    """Configuration for EthAccountWalletProvider."""

    account: LocalAccount
    chain_id: str
    gas: EvmGasConfig | None = Field(None, description="Gas configuration settings")
    rpc_url: str | None = Field(None, description="Optional RPC URL to override default chain RPC")

    class Config:
        """Configuration for EthAccountWalletProvider."""

        arbitrary_types_allowed = True


class EthAccountWalletProvider(EvmWalletProvider):
    """A wallet provider that uses eth-account and web3.py for EVM chain interactions."""

    def __init__(self, config: EthAccountWalletProviderConfig):
        """Initialize the wallet provider with an eth-account.

        Args:
            config (EthAccountWalletProviderConfig): Configuration options including account and network ID.

        """
        self.config = config
        self.account = config.account

        network_id = ""
        rpc_url = config.rpc_url

        if rpc_url is None:
            chain = NETWORK_ID_TO_CHAIN[CHAIN_ID_TO_NETWORK_ID[config.chain_id]]
            network_id = CHAIN_ID_TO_NETWORK_ID[config.chain_id]
            rpc_url = chain.rpc_urls["default"].http[0]

        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        self.web3.middleware_onion.inject(
            SignAndSendRawMiddlewareBuilder.build(self.account), layer=0
        )

        self._network = Network(
            protocol_family="evm",
            chain_id=self.config.chain_id,
            network_id=network_id,
        )

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

    def get_address(self) -> str:
        """Get the wallet address.

        Returns:
            str: The wallet's address as a hex string.

        """
        return self.account.address

    def get_network(self) -> Network:
        """Get the current network.

        Returns:
            Network: Network object containing protocol family, network ID, and chain ID.

        """
        return self._network

    def get_balance(self) -> Decimal:
        """Get the wallet balance in native currency.

        Returns:
            Decimal: The wallet's balance in wei as a Decimal

        """
        balance_wei = self.web3.eth.get_balance(self.account.address)
        return Decimal(str(balance_wei))

    def get_name(self) -> str:
        """Get the name of the wallet provider.

        Returns:
            str: The string 'eth_account_wallet_provider'

        """
        return "eth-account"

    def sign_message(self, message: str | bytes) -> HexStr:
        """Sign a message using the wallet's private key.

        Args:
            message (str | bytes): The message to sign, either as a string or bytes

        Returns:
            HexStr: The signature as a hex string

        """
        if isinstance(message, str):
            message = message.encode()
        message_obj = encode_defunct(message)
        signed = self.account.sign_message(message_obj)
        return HexStr(signed.signature.hex())

    def sign_typed_data(self, typed_data: dict[str, Any]) -> HexStr:
        """Sign typed data according to EIP-712 standard.

        Args:
            typed_data (dict[str, Any]): The typed data to sign following EIP-712 format

        Returns:
            HexStr: The signature as a hex string

        """
        signed = self.account.sign_typed_data(full_message=typed_data)
        return HexStr(signed.signature.hex())

    def sign_transaction(self, transaction: TxParams) -> SignedTransaction:
        """Sign an EVM transaction.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data.

        Returns:
            SignedTransaction: The signed transaction object

        """
        if "chainId" not in transaction:
            transaction["chainId"] = int(self._network.chain_id)
        if "from" not in transaction:
            transaction["from"] = self.account.address

        return self.account.sign_transaction(transaction)

    def estimate_fees(self):
        """Estimate gas fees for a transaction, applying the configured fee multipliers.

        Returns:
            tuple[int, int]: Tuple of (max_priority_fee_per_gas, max_fee_per_gas) in wei

        """

        def get_base_fee():
            """Get the base fee from the latest block and apply the multiplier.

            Returns:
                int: The adjusted base fee in wei

            """
            latest_block = self.web3.eth.get_block("latest")
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

    def send_transaction(self, transaction: TxParams) -> HexStr:
        """Send a signed transaction to the network.

        Args:
            transaction (TxParams): Transaction parameters including to, value, and data

        Returns:
            HexStr: The transaction hash as a hex string

        Raises:
            Exception: If transaction preparation or sending fails

        """
        transaction["from"] = self.account.address
        transaction["chainId"] = int(self._network.chain_id)

        nonce = self.web3.eth.get_transaction_count(self.account.address)
        transaction["nonce"] = nonce

        max_priority_fee_per_gas, max_fee_per_gas = self.estimate_fees()
        transaction["maxPriorityFeePerGas"] = max_priority_fee_per_gas
        transaction["maxFeePerGas"] = max_fee_per_gas

        gas = int(self.web3.eth.estimate_gas(transaction) * self._gas_limit_multiplier)
        transaction["gas"] = gas

        hash = self.web3.eth.send_transaction(transaction)
        return Web3.to_hex(hash)

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
        return self.web3.eth.wait_for_transaction_receipt(
            tx_hash, timeout=timeout, poll_latency=poll_latency
        )

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
        contract = self.web3.eth.contract(address=contract_address, abi=abi)
        func = contract.functions[function_name]
        if args is None:
            args = []
        return func(*args).call(block_identifier=block_identifier)

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer the native asset of the network.

        Args:
            to (str): The destination address to receive the transfer
            value (Decimal): The amount to transfer in whole units (e.g. 1.5 for 1.5 ETH)

        Returns:
            str: The transaction hash as a string

        Raises:
            Exception: If transfer fails

        """
        try:
            value_wei = Web3.to_wei(value, "ether")

            transfer_result = self.send_transaction(
                {
                    "to": Web3.to_checksum_address(to),
                    "value": value_wei,
                }
            )

            receipt = self.wait_for_transaction_receipt(transfer_result)
            if not receipt:
                raise Exception("Transaction failed")

            tx_hash = receipt["transactionHash"]
            if not tx_hash:
                raise Exception("Transaction hash not found")

            return tx_hash.hex()
        except Exception as e:
            raise Exception(f"Failed to transfer native tokens: {e!s}") from e
