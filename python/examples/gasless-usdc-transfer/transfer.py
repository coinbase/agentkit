"""EIP-3009 transferWithAuthorization helper for Base USDC.

The token owner signs a typed authorization off-chain.
A relayer submits the transaction and pays the gas fee.
No private key is ever sent across the wire or to the RPC endpoint.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

from eth_account import Account
from eth_account.signers.local import LocalAccount
from hexbytes import HexBytes
from web3 import Web3

# Base Mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (chainId: 8453)
# Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (chainId: 84532)
DEFAULT_BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
DEFAULT_CHAIN_ID = 8453

TRANSFER_WITH_AUTHORIZATION_ABI: list[dict[str, Any]] = [
    {
        "name": "transferWithAuthorization",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
            {"name": "v", "type": "uint8"},
            {"name": "r", "type": "bytes32"},
            {"name": "s", "type": "bytes32"},
        ],
    }
]


@dataclass(frozen=True)
class Authorization:
    """EIP-3009 authorization payload and signature."""

    owner: str
    recipient: str
    value: int
    valid_after: int
    valid_before: int
    nonce: bytes
    v: int
    r: bytes
    s: bytes


@dataclass(frozen=True)
class TransferResult:
    """Signed transaction data and optional broadcast hash."""

    authorization: Authorization
    transaction: Mapping[str, Any]
    tx_hash: HexBytes | None


class GaslessTransfer:
    """Build, sign, and optionally broadcast an EIP-3009 USDC transfer on Base."""

    def __init__(
        self,
        rpc_url: str,
        token_address: str = DEFAULT_BASE_USDC,
        chain_id: int = DEFAULT_CHAIN_ID,
        *,
        token_name: str = "USD Coin",
        token_version: str = "2",
    ) -> None:
        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        self.token_address = Web3.to_checksum_address(token_address)
        self.chain_id = chain_id
        self.token_name = token_name
        self.token_version = token_version

    def sign(
        self,
        private_key: str,
        recipient: str,
        amount: int,
        *,
        valid_for_seconds: int = 900,
        nonce: bytes | None = None,
        now: int | None = None,
    ) -> Authorization:
        """Sign a transfer authorization completely offline."""
        if amount <= 0:
            raise ValueError("amount must be positive")
        if valid_for_seconds <= 0:
            raise ValueError("valid_for_seconds must be positive")

        account: LocalAccount = Account.from_key(private_key)
        recipient = Web3.to_checksum_address(recipient)
        current = int(datetime.now(timezone.utc).timestamp()) if now is None else now
        nonce_bytes = nonce or Web3.keccak(text=f"{account.address}:{current}:{recipient}:{amount}")
        if len(nonce_bytes) != 32:
            raise ValueError("nonce must be exactly 32 bytes")

        message = {
            "from": account.address,
            "to": recipient,
            "value": amount,
            "validAfter": current,
            "validBefore": current + valid_for_seconds,
            "nonce": nonce_bytes,
        }
        typed = {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"},
                ],
                "TransferWithAuthorization": [
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "value", "type": "uint256"},
                    {"name": "validAfter", "type": "uint256"},
                    {"name": "validBefore", "type": "uint256"},
                    {"name": "nonce", "type": "bytes32"},
                ],
            },
            "primaryType": "TransferWithAuthorization",
            "domain": {
                "name": self.token_name,
                "version": self.token_version,
                "chainId": self.chain_id,
                "verifyingContract": self.token_address,
            },
            "message": message,
        }
        signed = account.sign_typed_data(full_message=typed)
        return Authorization(
            owner=account.address,
            recipient=recipient,
            value=amount,
            valid_after=current,
            valid_before=current + valid_for_seconds,
            nonce=nonce_bytes,
            v=signed.v,
            r=signed.r.to_bytes(32, "big"),
            s=signed.s.to_bytes(32, "big"),
        )

    def build_transaction(
        self,
        authorization: Authorization,
        relayer: str,
        *,
        gas: int = 180_000,
        nonce: int | None = None,
    ) -> dict[str, Any]:
        """Build the relayer transaction for gas-sponsored broadcast; no transaction is sent."""
        relayer = Web3.to_checksum_address(relayer)
        contract = self.web3.eth.contract(address=self.token_address, abi=TRANSFER_WITH_AUTHORIZATION_ABI)
        tx = dict(
            contract.functions.transferWithAuthorization(
                authorization.owner,
                authorization.recipient,
                authorization.value,
                authorization.valid_after,
                authorization.valid_before,
                authorization.nonce,
                authorization.v,
                authorization.r,
                authorization.s,
            ).build_transaction({"from": relayer, "chainId": self.chain_id, "gas": gas})
        )
        tx.setdefault("chainId", self.chain_id)
        tx.setdefault("gas", gas)
        if nonce is not None:
            tx["nonce"] = nonce
        return tx

    def broadcast(self, transaction: Mapping[str, Any], relayer_key: str) -> HexBytes:
        """Sign and broadcast the relayer transaction. Only called when explicitly opting into on-chain submission."""
        signed = self.web3.eth.account.sign_transaction(dict(transaction), relayer_key)
        return self.web3.eth.send_raw_transaction(signed.raw_transaction)
