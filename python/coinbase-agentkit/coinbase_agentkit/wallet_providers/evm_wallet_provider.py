from abc import ABC, abstractmethod
from typing import Any

from eth_account.datastructures import SignedTransaction
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from .wallet_provider import WalletProvider


class EvmWalletProvider(WalletProvider, ABC):
    """Abstract base class for all EVM wallet providers."""

    @abstractmethod
    def sign_message(self, message: str | bytes) -> HexStr:
        """Sign a message using the wallet's private key."""
        pass

    @abstractmethod
    def sign_typed_data(self, typed_data: dict[str, Any]) -> HexStr:
        """Sign typed data according to EIP-712 standard."""
        pass

    @abstractmethod
    def sign_transaction(self, transaction: TxParams) -> SignedTransaction:
        """Sign an EVM transaction."""
        pass

    @abstractmethod
    def send_transaction(self, transaction: TxParams) -> HexStr:
        """Send a signed transaction to the network."""
        pass

    @abstractmethod
    def get_transaction_receipt(self, tx_hash: HexStr) -> dict[str, Any]:
        """Get the transaction receipt for a given transaction hash."""
        pass

    @abstractmethod
    def wait_for_transaction_receipt(
        self, tx_hash: HexStr, timeout: float = 120, poll_latency: float = 0.1
    ) -> dict[str, Any]:
        """Wait for transaction confirmation and return receipt."""
        pass

    @abstractmethod
    def read_contract(
        self,
        contract_address: ChecksumAddress,
        abi: list[dict[str, Any]],
        function_name: str,
        args: list[Any] | None = None,
        block_identifier: BlockIdentifier = "latest",
    ) -> Any:
        """Read data from a smart contract."""
        pass

    @abstractmethod
    def invoke_contract(self, *args, **kwargs):
        pass
