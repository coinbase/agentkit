"""Nano (XNO) wallet provider.

Nano is a feeless, self-custodial, sub-second-finality digital currency — a
settlement rail with no per-transfer network fee, no gas, and no issuer that
can freeze or reverse a payment. This provider gives an agent the same
``WalletProvider`` interface AgentKit already exposes for EVM and Solana, so a
Nano rail slots in next to them.

Why a signed-block provider
---------------------------
Nano transacts by submitting **signed state blocks** to the network, not by
signing a message over the wire. Every balance-changing action on an account
is one ``state`` block that carries the account's whole current state:

- ``account`` — the sender/receiver account's ``nano_`` address
- ``previous`` — the account's current frontier (head block hash), or ``0``
  when the account is still unopened (the block is then an *open* block)
- ``representative`` — the account's representative (kept constant)
- ``balance`` — the account's *resulting* balance after the block, in raw
- ``link`` — the destination account's **public key hash** for a send, or the
  **send block hash** being received for a receive
- ``signature`` — Ed25519 (Blake2b) signature over the block hash
- ``work`` — a proof-of-work nonce above the network threshold

The amount transferred is the *difference* between ``balance`` on consecutive
blocks: a send debits the sender's balance by ``amount``, a receive credits
the recipient's by the same. Because the block carries the resulting balance
and the network enforces monotonicity, a receive is required for the recipient
to learn it was paid and spend the funds.

About work (proof-of-work)
--------------------------
Work thresholds are not uniform across block types: a **send** requires work
at or above ``fffffff800000000``, while a **receive/open** (the first block of
an account) requires ``fffffe0000000000``. This provider asks the Nano RPC to
generate the correct work for the block by passing ``do_work: true`` to
``process``, and it exposes ``SEND_WORK_THRESHOLD`` / ``RECEIVE_WORK_THRESHOLD``
so callers can precompute work offline when they want to.
"""

from __future__ import annotations

import os
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from ..network import Network
from .wallet_provider import WalletProvider


class NanoWalletProviderConfig(BaseModel):
    """Configuration for NanoWalletProvider.

    A ``seed`` is required to sign blocks (send / receive). An account with no
    seed is read-only: it can report balance and receivable funds but cannot
    publish blocks.
    """

    address: str | None = Field(
        None, description="The Nano account (address) the provider controls"
    )
    seed: str | None = Field(
        None,
        description="64-hex seed used to derive the signing key (required to send/receive)",
    )
    rpc_url: str | None = Field(None, description="Nano RPC endpoint (default: a public node)")


class NanoWalletProvider(WalletProvider):
    """A wallet provider for the Nano (XNO) network.

    Nano has no gas and no per-transfer fee, so a transfer settles for exactly
    the amount requested. Transfers are submitted as signed ``state`` blocks;
    the provider signs with the account's Ed25519/Blake2b key derived from the
    configured seed and asks the RPC to generate proof-of-work.
    """

    #: Nano's transactional currency is XNO (1 XNO = 10^30 raw).
    RAW_PER_XNO = Decimal(10) ** 30

    #: Work threshold for a send block (>= this value).
    SEND_WORK_THRESHOLD = "fffffff800000000"
    #: Work threshold for a receive / open block (>= this value).
    RECEIVE_WORK_THRESHOLD = "fffffe0000000000"

    #: All-zero previous-hash: the value a block uses when the account is unopened.
    ZERO_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

    def __init__(self, config: NanoWalletProviderConfig):
        """Initialize the Nano wallet provider with an address and RPC endpoint.

        Args:
            config (NanoWalletProviderConfig): Configuration including the Nano
                address, an optional seed (needed to sign blocks) and an
                optional RPC URL override.

        Raises:
            ValueError: If neither ``address`` nor ``seed`` is provided, or if a
                given seed does not derive the given address.

        """
        self.config = config
        self._seed = config.seed
        self._rpc_url: str = config.rpc_url or str(
            os.getenv("NANO_RPC_URL", "https://rpc.nano.to")
        )
        if not config.address and not self._seed:
            raise ValueError("NanoWalletProvider needs an address or a seed")
        seed_local = self._seed  # narrowed by the guard above
        addr = config.address
        if addr is None:
            assert seed_local is not None
            addr = self._derive_address(seed_local)
        self._address = addr
        if self._seed and config.address and self._derive_address(self._seed) != config.address:
            raise ValueError("the configured seed does not derive the configured address")
        self._network = Network(
            protocol_family="xno",
            network_id="nano:mainnet",
            chain_id=None,  # Nano has no EVM-style chain id
        )
        self._signing_key: Any = None
        if self._seed:
            self._signing_key = self._derive_signing_key(self._seed)

    # -------------------------------------------------------------
    # Nano helpers (kept out of the public interface)
    # -------------------------------------------------------------
    @staticmethod
    def _hex_to_bytes(h: str) -> bytes:
        return bytes.fromhex(h)

    @staticmethod
    def _bytes_to_hex(b: bytes) -> str:
        return b.hex().upper()

    @staticmethod
    def _derive_signing_key(seed: str) -> Any:
        """Derive the Ed25519 (Blake2b) signing key at index 0 of ``seed``.

        Uses the same key-derivation the reference Nano wallet uses: the
        private key is ``blake2b(seed || index_4bytes)`` with digest size 32.
        """
        import hashlib

        from ed25519_blake2b import SigningKey

        seed_b = NanoWalletProvider._hex_to_bytes(seed)
        if len(seed_b) != 32:
            raise ValueError("a Nano seed must be 64 hex characters (32 bytes)")
        h = hashlib.blake2b(digest_size=32)
        h.update(seed_b)
        h.update((0).to_bytes(4, "big"))
        return SigningKey(h.digest())

    @staticmethod
    def _public_key_from_address(address: str) -> str:
        """Decode a ``nano_`` address's embedded public key (64 hex chars)."""
        from nanohakase.util import get_public_key_from_address

        return str(get_public_key_from_address(address))

    def _address_from_seed(self, seed: str) -> str:
        """Derive the ``nano_`` address for index 0 of ``seed``."""
        from nanohakase.util import (
            get_address_from_public_key,
        )

        sk = NanoWalletProvider._derive_signing_key(seed)
        pub = NanoWalletProvider._bytes_to_hex(sk.get_verifying_key().to_bytes())
        return str(get_address_from_public_key(pub))

    def _derive_address(self, seed: str) -> str:
        return self._address_from_seed(seed)

    def _hash_block(self, block: dict[str, Any]) -> str:
        """Compute the 32-byte hash of a ``state`` block (Blake2b preamble)."""
        import hashlib

        b = hashlib.blake2b(digest_size=32)
        b.update(self._hex_to_bytes("0000000000000000000000000000000000000000000000000000000000000006"))
        b.update(self._hex_to_bytes(self._public_key_from_address(block["account"])))
        b.update(self._hex_to_bytes(block["previous"]))
        b.update(self._hex_to_bytes(self._public_key_from_address(block["representative"])))
        padded = hex(int(block["balance"]))[2:]
        while len(padded) < 32:
            padded = "0" + padded
        b.update(self._hex_to_bytes(padded))
        b.update(self._hex_to_bytes(block["link"]))
        return self._bytes_to_hex(b.digest())

    def _sign_block(self, block: dict[str, Any]) -> str:
        """Sign a block with the account's key; returns 128-hex signature."""
        block_hash = self._hash_block(block)
        self._require_signing()
        sig = self._signing_key.sign(self._hex_to_bytes(block_hash))
        return self._bytes_to_hex(sig)

    def _require_signing(self) -> None:
        if not self._signing_key:
            raise RuntimeError(
                "this NanoWalletProvider is read-only: pass a seed to sign blocks"
            )

    def _rpc(self, action: str, **params: Any) -> dict[str, Any]:
        """Call the Nano RPC and return its ``result``."""
        import json
        import urllib.request

        body = json.dumps({"action": action, **params}).encode()
        req = urllib.request.Request(
            self._rpc_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data: dict[str, Any] = json.loads(resp.read().decode())
        except Exception as e:
            raise RuntimeError(f"Nano RPC call failed for action '{action}': {e!s}") from e
        if "error" in data:
            raise RuntimeError(f"Nano RPC error for action '{action}': {data['error']}")
        result: dict[str, Any] = data.get("result", {})
        return result

    def _account_info(self) -> dict[str, Any]:
        """Return the current account state: frontier, representative, balance (raw)."""
        return self._rpc("account_info", account=self._address)

    def _process(self, block: dict[str, Any], subtype: str) -> str:
        """Submit a signed block, asking the RPC to generate its work.

        Returns the confirmed block hash.
        """
        result = self._rpc(
            "process",
            subtype=subtype,
            json_block="true",
            block=block,
            do_work="true",
        )
        return str(result.get("hash", ""))

    # -------------------------------------------------------------
    # WalletProvider interface
    # -------------------------------------------------------------
    def get_address(self) -> str:
        """Get the wallet address."""
        return self._address

    def get_network(self) -> Network:
        """Get the current network."""
        return self._network

    def get_balance(self) -> Decimal:
        """Get the wallet balance in native currency (XNO).

        Returns the **available** (spendable) balance; funds awaiting a
        receive block are not included. Use :meth:`receivable` to see those.

        Returns:
            Decimal: The spendable balance in XNO.

        Raises:
            RuntimeError: If the balance cannot be fetched from the RPC.

        """
        result = self._rpc("account_balance", account=self._address)
        balance = Decimal(str(result.get("balance", "0")))
        return balance / self.RAW_PER_XNO

    def sign_message(self, message: str) -> str:
        """Sign a message with the account's Ed25519/Blake2b key.

        Nano does not use message signing for payments (transfers are signed
        blocks), but this returns a real signature when a seed is configured, so
        an agent can authenticate attestations with the same key that controls
        the account.

        Args:
            message (str): The message to sign.

        Returns:
            str: A 128-hex Ed25519/Blake2b signature of the message.

        Raises:
            RuntimeError: If the provider is read-only (no seed).

        """
        import hashlib

        self._require_signing()
        h = hashlib.blake2b(digest_size=32)
        msg = message.encode() if isinstance(message, str) else message
        h.update(msg)
        sig = self._signing_key.sign(h.digest())
        return self._bytes_to_hex(sig)

    def get_name(self) -> str:
        """Get the name of the wallet provider."""
        return "nano_wallet_provider"

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer the native asset (XNO).

        Builds and signs a Nano ``state`` send block. The recipient's account
        must publish a matching receive block before it can spend the funds;
        see :meth:`receive` for the recipient side.

        Args:
            to (str): The destination Nano account.
            value (Decimal): The amount to send, in XNO.

        Returns:
            str: The hash of the published send block confirming the transfer.

        Raises:
            RuntimeError: If the account is read-only or the block is rejected.

        """
        raw = int(Decimal(value) * self.RAW_PER_XNO)
        self._require_signing()
        info = self._account_info()
        frontier = info.get("frontier") or self.ZERO_HASH
        representative = info.get("representative") or self._address
        before_balance = int(info.get("balance", "0"))
        if raw > before_balance:
            raise RuntimeError(
                f"insufficient balance: {before_balance} raw available, tried to send {raw}"
            )
        block = {
            "type": "state",
            "account": self._address,
            "previous": frontier,
            "representative": representative,
            "balance": str(before_balance - raw),
            "link": self._public_key_from_address(to),
            "link_as_account": to,
        }
        block["signature"] = self._sign_block(block)
        return self._process(block, "send")

    # -------------------------------------------------------------
    # Nano-specific receive path (the payment leg this provider exists for)
    # -------------------------------------------------------------
    def receivable(self) -> list[dict[str, Any]]:
        """List pending incoming blocks the account has not yet received.

        Nano credits a send only after the recipient publishes a receive block.
        Until then the funds are "receivable" and shown by ``account_balance``
        as pending. This is the signal an agent needs to know it was paid.

        Returns:
            list[dict]: Each ``{hash, amount, source}`` — the send block hash,
                its amount in raw, and the sending account.

        """
        result = self._rpc("receivable", account=self._address)
        blocks = result.get("blocks") or {}
        out = []
        for h, info in blocks.items():
            out.append(
                {
                    "hash": h,
                    "amount": int(info.get("amount", "0")),
                    "source": info.get("source", ""),
                }
            )
        return out

    def receive(self, block_hash: str) -> str:
        """Receive a pending send, publishing the matching ``state`` receive block.

        Credits the incoming amount to this account's balance and removes it from
        the receivable set. This is the step that makes an agent actually hold the
        Nano it was paid.

        Args:
            block_hash (str): The send block hash to receive (from :meth:`receivable`).

        Returns:
            str: The hash of the published receive block.

        Raises:
            RuntimeError: If the account is read-only or the block is rejected.

        """
        self._require_signing()
        # The receive block's link is the send block hash; amount comes from the block info.
        info = self._rpc("block_info", json_block="true", hash=block_hash)
        amount = int(info.get("amount", "0"))
        try:
            account_info = self._account_info()
            frontier = account_info.get("frontier") or self.ZERO_HASH
            representative = account_info.get("representative") or self._address
            before_balance = int(account_info.get("balance", "0"))
        except RuntimeError:
            # Unopened account: this receive is the account's first (open) block.
            frontier = self.ZERO_HASH
            representative = self._address
            before_balance = 0
        block = {
            "type": "state",
            "account": self._address,
            "previous": frontier,
            "representative": representative,
            "balance": str(before_balance + amount),
            "link": block_hash,
        }
        block["signature"] = self._sign_block(block)
        return self._process(block, "receive")
