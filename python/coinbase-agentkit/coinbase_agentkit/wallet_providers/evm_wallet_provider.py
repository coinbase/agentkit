"""Base class for EVM-compatible wallet providers."""

from abc import ABC, abstractmethod
from typing import Any

from eth_account.datastructures import SignedMessage, SignedTransaction
from eth_account.messages import SignableMessage, _hash_eip191_message, encode_typed_data
from eth_account.signers.base import BaseAccount
from eth_account.types import TransactionDictType
from eth_typing import Hash32
from eth_utils import to_bytes
from pydantic import BaseModel, Field
from web3.types import BlockIdentifier, ChecksumAddress, HexStr, TxParams

from .wallet_provider import WalletProvider


class EvmGasConfig(BaseModel):
    """Configuration for gas multipliers."""

    gas_limit_multiplier: float | None = Field(
        None, description="An internal multiplier on gas limit estimation"
    )
    fee_per_gas_multiplier: float | None = Field(
        None, description="An internal multiplier on fee per gas estimation"
    )


class EvmWalletSigner(BaseAccount):
    """A class compatible with eth_account's BaseAccount.

    This class wraps an EvmWalletProvider and provides a BaseAccount interface.
    It may be used to sign transactions and messages for an EVM wallet provider.

    Args:
        wallet_provider (EvmWalletProvider): The EVM wallet provider to sign transactions and messages for.

    """

    def __init__(self, wallet_provider: "EvmWalletProvider"):
        """Initialize the EvmWalletSigner class.

        Args:
            wallet_provider (EvmWalletProvider): The EVM wallet provider to sign transactions and messages for.

        """
        self._wallet_provider = wallet_provider

    @property
    def address(self) -> str:
        """Get the address of the EVM wallet provider.

        Returns:
            str: The address of the EVM wallet provider.

        """
        return self._wallet_provider.get_address()

    def unsafe_sign_hash(self, message_hash: Hash32) -> SignedMessage:
        """Sign a message hash.

        WARNING: Never sign a hash that you didn't generate,
        it can be an arbitrary transaction.

        Args:
            message_hash (Hash32): The 32-byte message hash to sign.

        Returns:
            SignedMessage: The signed message.

        """
        # Convert Hash32 to hex string and sign
        message_hex = message_hash.hex()
        signature = self._wallet_provider.sign_message(message_hex)
        # Note: This is a simplified implementation. In practice, you might need
        # to construct a proper SignedMessage object from the signature
        return SignedMessage(
            messageHash=message_hash,
            r=signature[:66],  # First 32 bytes as hex
            s=signature[66:130],  # Next 32 bytes as hex
            v=int(signature[130:], 16),  # Recovery byte
            message=message_hex,
            signature=signature,
        )

    def sign_message(self, signable_message: SignableMessage) -> SignedMessage:
        """Sign a message.

        Args:
            signable_message (SignableMessage): The message to sign.

        Returns:
            SignedMessage: The signed message.

        """
        message = signable_message.body
        signature = self._wallet_provider.sign_message(message)
        return SignedMessage(
            messageHash=signable_message.hash,
            r=signature[:66],  # First 32 bytes as hex
            s=signature[66:130],  # Next 32 bytes as hex
            v=int(signature[130:], 16),  # Recovery byte
            message=message,
            signature=signature,
        )

    def sign_transaction(self, transaction_dict: TransactionDictType) -> SignedTransaction:
        """Sign a transaction.

        Args:
            transaction_dict (TransactionDictType): The transaction to sign.

        Returns:
            SignedTransaction: The signed transaction.

        """
        return self._wallet_provider.sign_transaction(transaction_dict)

    def sign_typed_data(
        self,
        domain_data: dict[str, Any] | None = None,
        message_types: dict[str, Any] | None = None,
        message_data: dict[str, Any] | None = None,
        full_message: dict[str, Any] | None = None,
    ) -> SignedMessage:
        # Step 1: Construct typed data
        if full_message is not None:
            typed_data = full_message
        else:
            if not (domain_data and message_types and message_data):
                raise ValueError("Must provide either full_message or domain_data + message_types + message_data")

            domain_type = self._get_types_for_eip712_domain(domain_data)
            message_types = dict(message_types)  # Copy to avoid mutation
            message_types["EIP712Domain"] = domain_type

            # Find primaryType
            primary_types = [t for t in message_types if t != "EIP712Domain"]
            if len(primary_types) != 1:
                raise ValueError("Unable to determine primaryType; found: " + ", ".join(primary_types))
            primary_type = primary_types[0]

            processed_data = self._process_message_bytes(message_data, message_types, primary_type)
            typed_data = {
                "types": message_types,
                "domain": domain_data,
                "primaryType": primary_type,
                "message": processed_data,
            }

        # Step 2: Encode and hash message
        signable = encode_typed_data(full_message=typed_data)
        message_hash = _hash_eip191_message(signable)

        # Step 3: Sign via wallet provider
        signature = self._wallet_provider.sign_typed_data(typed_data)  # returns HexStr like "0x..."
        sig_bytes = to_bytes(hexstr=signature)
        r = "0x" + sig_bytes[:32].hex()
        s = "0x" + sig_bytes[32:64].hex()
        v = sig_bytes[64]

        return SignedMessage(
            message_hash=message_hash,
            r=r,
            s=s,
            v=v,
            signature=sig_bytes,
        )

    def _get_types_for_eip712_domain(
        self, domain: dict[str, Any] | None = None
    ) -> list[dict[str, str]]:
        """Get types for EIP712Domain based on the domain properties that are present.

        This function dynamically generates the EIP712Domain type definition based on
        which domain properties are provided.

        Args:
            domain: The domain data dictionary

        Returns:
            List of field definitions for EIP712Domain type

        """
        types = []

        if domain is None:
            return types

        if isinstance(domain.get("name"), str):
            types.append({"name": "name", "type": "string"})

        if domain.get("version"):
            types.append({"name": "version", "type": "string"})

        if isinstance(domain.get("chainId"), int):
            types.append({"name": "chainId", "type": "uint256"})

        if domain.get("verifyingContract"):
            types.append({"name": "verifyingContract", "type": "address"})

        if domain.get("salt"):
            types.append({"name": "salt", "type": "bytes32"})

        return types

    def _process_message_bytes(
        self,
        message: dict[str, Any],
        types: dict[str, Any],
        type_key: str,
    ) -> dict[str, Any]:
        """Process message data to handle bytes32 types properly.

        Args:
            message: The message data
            types: The type definitions
            type_key: The key of the type to process

        Returns:
            The processed message with bytes32 values properly encoded

        """

        def _find_field_type(field_name: str, fields: list) -> str | None:
            for field in fields:
                if field["name"] == field_name:
                    return field["type"]
            return None

        type_fields = types[type_key]
        processed_message = {}

        for key, value in message.items():
            processed_message[key] = value
            if isinstance(value, dict):
                # Handle nested objects by recursively processing them
                value_type = _find_field_type(key, type_fields)
                if value_type:
                    processed_message[key] = self._process_message_bytes(value, types, value_type)
            elif isinstance(value, bytes) and _find_field_type(key, type_fields) == "bytes32":
                # Handle bytes32 values so our internal sign typed data can serialize them properly
                value_str = value.hex()
                processed_message[key] = (
                    "0x" + value_str if not value_str.startswith("0x") else value_str
                )

        return processed_message


    def __str__(self) -> str:
        """Return a string representation of the EvmWalletSigner object.

        Returns:
            str: A string representation of the EvmWalletSigner.

        """
        return f"EVM Wallet Signer Address: {self.address}"

    def __repr__(self) -> str:
        """Return a string representation of the EvmWalletSigner object.

        Returns:
            str: A string representation of the EvmWalletSigner.

        """
        return str(self)


class EvmWalletProvider(WalletProvider, ABC):
    """Abstract base class for all EVM wallet providers."""

    def to_signer(self) -> EvmWalletSigner:
        """Convert the wallet provider to an eth_account compatible signer.

        Returns:
            EvmWalletSigner: The eth_account compatible signer.

        """
        return EvmWalletSigner(self)

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
