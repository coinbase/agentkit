from decimal import Decimal
from typing import Any

from cdp import Cdp, EncodedCall, SmartWallet, UserOperation, to_smart_wallet
from cdp.evm_call_types import ContractCall
from eth_account.account import LocalAccount
from eth_account.datastructures import SignedTransaction
from pydantic import BaseModel, Field
from web3 import Web3
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from ..__version__ import __version__
from ..network import NETWORK_ID_TO_CHAIN, Network
from .evm_wallet_provider import EvmWalletProvider


class SmartWalletProviderConfig(BaseModel):
    """Configuration for SmartWalletProvider."""

    network_id: str = Field("base-sepolia", description="The network ID")
    signer: LocalAccount
    smart_wallet_address: str | None = Field(None, description="Smart wallet address")
    cdp_api_key_name: str | None = Field(None, description="The CDP API Key Name")
    cdp_api_key_private_key: str | None = Field(None, description="The CDP API Key Private Key")
    paymaster_url: str | None = Field(
        None, description="URL for the paymaster service to sponsor transactions"
    )

    class Config:
        """Configuration for SmartWalletProvider."""

        arbitrary_types_allowed = True


class SmartWalletProvider(EvmWalletProvider):
    """A wallet provider that uses the Coinbase Smart Wallet SDK."""

    def __init__(self, config: SmartWalletProviderConfig):
        """Initialize the SmartWalletProvider."""
        self._network_id = config.network_id
        self._network = Network(
            protocol_family="evm",
            network_id=config.network_id,
            chain_id=NETWORK_ID_TO_CHAIN[config.network_id].id,
        )
        self._web3 = Web3(
            Web3.HTTPProvider(NETWORK_ID_TO_CHAIN[config.network_id].rpc_urls["default"].http[0])
        )

        if config.cdp_api_key_name and config.cdp_api_key_private_key:
            Cdp.configure(
                api_key_name=config.cdp_api_key_name,
                private_key=config.cdp_api_key_private_key.replace("\\n", "\n"),
                source="agentkit",
                source_version=__version__,
            )
        else:
            Cdp.configure_from_json(source="agentkit", source_version=__version__)

        if config.smart_wallet_address:
            self._smart_wallet = to_smart_wallet(
                signer=config.signer, smart_wallet_address=config.smart_wallet_address
            )
        else:
            self._smart_wallet = SmartWallet.create(config.signer)

        self._smart_wallet = self._smart_wallet.use_network(
            chain_id=int(self._network.chain_id),
            paymaster_url=config.paymaster_url,
        )

    def get_address(self) -> str:
        """Get the smart wallet address."""
        return self._smart_wallet.address

    def get_network(self) -> Network:
        """Get the network information."""
        return self._network

    def get_name(self) -> str:
        """Get the name of the wallet provider."""
        return "cdp_smart_wallet_provider"

    def sign_message(self, message: str | bytes) -> HexStr:
        """Smart wallets cannot sign raw messages.

        Raises:
            NotImplementedError: Always, since smart wallets do not support signing raw messages.

        """
        raise NotImplementedError("Smart wallets do not support signing raw messages.")

    def sign_typed_data(self, typed_data: dict[str, Any]) -> HexStr:
        """Smart wallets cannot sign typed data.

        Raises:
            NotImplementedError: Always, since smart wallets do not support signing typed data.

        """
        raise NotImplementedError("Smart wallets do not support signing typed data.")

    def sign_transaction(self, transaction: TxParams) -> SignedTransaction:
        """Smart wallets cannot sign transactions.

        Raises:
            NotImplementedError: Always, since smart wallets do not support signing transactions.

        """
        raise NotImplementedError("Smart wallets do not support signing transactions.")

    def send_transaction(self, transaction: TxParams) -> HexStr:
        """Send a transaction using the smart wallet.

        Unlike traditional Ethereum transactions, this method submits a User Operation
        instead of directly broadcasting a transaction. The smart wallet handles execution,
        but a standard transaction hash is still returned upon completion.
        """
        user_operation = self._smart_wallet.send_user_operation(
            calls=[
                EncodedCall(
                    to=transaction["to"],
                    data=transaction.get("data", b""),
                    value=transaction.get("value", 0),
                ),
            ]
        )
        result = user_operation.wait()
        if result.status == UserOperation.Status.COMPLETE:
            return result.transaction_hash
        else:
            raise Exception("Transaction failed")

    def send_user_operation(
        self,
        calls: list[ContractCall],
    ) -> HexStr:
        """Send a user operation directly.

        This method directly exposes the sendUserOperation functionality, allowing
        SmartWallet-aware tools to fully leverage its capabilities, including batching multiple calls.
        Unlike send_transaction, which wraps calls in a single operation, this method allows
        direct execution of arbitrary operations within a User Operation.
        """
        user_operation = self._smart_wallet.send_user_operation(calls=calls)
        result = user_operation.wait()
        if result.status == UserOperation.Status.COMPLETE:
            return result.transaction_hash
        raise Exception(f"Operation failed with status: {result.status}")

    def wait_for_transaction_receipt(
        self, tx_hash: HexStr, timeout: float = 120, poll_latency: float = 0.1
    ) -> dict[str, Any]:
        """Wait for a transaction receipt."""
        return self._web3.eth.wait_for_transaction_receipt(
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
        """Read data from a smart contract."""
        contract = self._web3.eth.contract(address=contract_address, abi=abi)
        func = contract.functions[function_name]
        return func(*(args or [])).call(block_identifier=block_identifier)

    def get_balance(self) -> Decimal:
        """Get the balance of the smart wallet."""
        balance = self._web3.eth.get_balance(self.get_address())
        return Decimal(balance)

    def native_transfer(self, to: str, value: Decimal) -> HexStr:
        """Transfer native assets using the smart wallet."""
        value_wei = Web3.to_wei(value, "ether")
        user_operation = self._smart_wallet.send_user_operation(
            calls=[
                EncodedCall(to=to, value=value_wei, data="0x"),
            ]
        )
        result = user_operation.wait(interval_seconds=0.2, timeout_seconds=20)
        if result.status == UserOperation.Status.COMPLETE:
            return result.transaction_hash
        else:
            raise Exception("Transaction failed")
