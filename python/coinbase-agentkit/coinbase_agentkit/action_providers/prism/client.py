"""Client for Prism Network: wallet-signature auth, onchain USDG payment, provisioning, SSH.

The client holds its own wallet, authenticates to the Prism control plane with an
EIP-191 signature, pays into the onchain lease escrow in USDG, waits for the machine
to provision, and runs commands over SSH.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass

import requests
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

from .constants import (
    CHAIN_ID,
    CONFIRMATIONS,
    DEFAULT_API_BASE,
    DIGEST_PATTERN,
    ERC20_ABI,
    ESCROW_ABI,
    FETCH_TIMEOUT,
    ROBINHOOD_RPC,
    USDG_ADDRESS,
)


class PrismError(Exception):
    """An error returned by the Prism control plane or the chain."""

    def __init__(self, status: int, code: str, body: object = None) -> None:
        """Store the HTTP-like status, machine code, and optional body."""
        super().__init__(f"prism {status}: {code}")
        self.status = status
        self.code = code
        self.body = body


@dataclass
class Lease:
    """A funded GPU lease and its SSH access material."""

    lease_id: int
    access: dict
    key_path: str
    key_dir: str
    public_key: str
    funding_hash: str
    quote: dict


class PrismClient:
    """Headless GPU leasing for a wallet-holding agent."""

    def __init__(
        self,
        private_key: str,
        escrow: str,
        api_base: str = DEFAULT_API_BASE,
        rpc_url: str = ROBINHOOD_RPC,
    ) -> None:
        """Build a client from a wallet key and the lease-escrow address."""
        if not escrow:
            raise ValueError("escrow address is required")
        self.api_base = api_base.rstrip("/")
        self.escrow = Web3.to_checksum_address(escrow)
        self.account = Account.from_key(private_key)
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self._usdg = self.w3.eth.contract(address=USDG_ADDRESS, abi=ERC20_ABI)
        self._escrow = self.w3.eth.contract(address=self.escrow, abi=ESCROW_ABI)
        self.session: str | None = None

    @property
    def address(self) -> str:
        """The agent wallet's checksummed address."""
        return self.account.address

    def authenticate(self) -> dict:
        """Prove wallet ownership with a signature and open a session."""
        challenge = self._json("GET", f"/api/agent/challenge?address={self.address}")
        signed = self.account.sign_message(encode_defunct(text=challenge["message"]))
        sig = signed.signature.hex()
        session = self._json(
            "POST",
            "/api/agent/session",
            {
                "challenge": challenge["challenge"],
                "address": self.address,
                "signature": sig if sig.startswith("0x") else "0x" + sig,
            },
        )
        self.session = session["session"]
        return session

    def offers(self) -> list:
        """List GPU offers currently available to lease."""
        return self._proxy("GET", ["offers"])

    def balances(self) -> dict:
        """Return the wallet address and its USDG and native balances."""
        return {
            "address": self.address,
            "usdg": self._usdg.functions.balanceOf(self.address).call(),
            "eth": self.w3.eth.get_balance(self.address),
        }

    def quote(
        self,
        image: str,
        duration_seconds: int,
        min_vram_mib: int = 16000,
        preferred_node_id: str | None = None,
    ) -> dict:
        """Request a price quote for a lease matching the given constraints."""
        if not isinstance(image, str) or not DIGEST_PATTERN.search(image):
            raise PrismError(400, "image_must_be_digest_pinned")
        return self._proxy(
            "POST",
            ["leases", "match"],
            {
                "request": {
                    "image": image,
                    "duration_seconds": duration_seconds,
                    "min_vram_mib": min_vram_mib,
                    "preferred_node_id": preferred_node_id,
                }
            },
        )

    def confirm(self, quote_id: str, transaction_hash: str, ssh_authorized_key: str) -> dict:
        """Confirm a funded quote with its onchain transaction and SSH key."""
        return self._proxy(
            "POST",
            ["leases", "confirm"],
            {
                "quote_id": quote_id,
                "transaction_hash": transaction_hash,
                "ssh_authorized_key": ssh_authorized_key,
            },
        )

    def leases(self) -> list:
        """List the wallet's leases."""
        return self._proxy("GET", ["leases"])

    def access(self, lease_id: int) -> dict:
        """Fetch SSH access details for a lease."""
        return self._proxy("GET", ["leases", str(lease_id), "access"])

    def wait_for_access(self, lease_id: int, timeout: int = 600, interval: int = 10) -> dict:
        """Poll until a lease's SSH access is ready or the timeout elapses."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            status, body = self._proxy("GET", ["leases", str(lease_id), "access"], raw=True)
            if status == 200:
                return body
            if status != 404:
                raise PrismError(status, (body or {}).get("error", "access_error"))
            time.sleep(interval)
        raise PrismError(408, "access_timeout")

    def lease(
        self,
        image: str,
        duration_seconds: int,
        min_vram_mib: int = 16000,
        preferred_node_id: str | None = None,
        max_deposit: int | None = None,
    ) -> Lease:
        """Quote, fund onchain, confirm, and wait for a provisioned GPU."""
        if not self.session:
            self.authenticate()
        quote = self.quote(image, duration_seconds, min_vram_mib, preferred_node_id)
        if max_deposit is not None and int(quote["maximum_escrow"]) > int(max_deposit):
            raise PrismError(
                402,
                "cost_exceeds_max",
                {"required": quote["maximum_escrow"], "max": str(max_deposit)},
            )
        key = self._generate_ssh_key()
        try:
            funding = self._fund(quote)
            record = self.confirm(quote["quote_id"], funding, key["public_key"])
            lease_id = record["lease_id"]
            return Lease(
                lease_id,
                self.wait_for_access(lease_id),
                key["key_path"],
                key["dir"],
                key["public_key"],
                funding,
                quote,
            )
        except Exception:
            shutil.rmtree(key["dir"], ignore_errors=True)
            raise

    def run(
        self,
        lease: Lease,
        command: str,
        timeout: int = 120,
        connect_retries: int = 24,
        connect_delay: int = 10,
    ) -> dict:
        """Run a command on a leased GPU over SSH, retrying while it warms up."""
        a = lease.access
        args = [
            "ssh",
            "-i",
            lease.key_path,
            "-p",
            str(a["ssh_port"]),
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=15",
            f"{a.get('ssh_user', 'root')}@{a['ssh_host']}",
            command,
        ]
        last = None
        for attempt in range(connect_retries + 1):
            try:
                p = subprocess.run(args, capture_output=True, text=True, timeout=timeout + 20)
                res = {"code": p.returncode, "stdout": p.stdout.strip(), "stderr": p.stderr.strip()}
            except subprocess.TimeoutExpired:
                res = {"code": -1, "stdout": "", "stderr": "timed out"}
            if not _is_ssh_warmup(res):
                return res
            last = res
            if attempt < connect_retries:
                time.sleep(connect_delay)
        return last

    def end_lease(self, lease: Lease) -> None:
        """Release local key material. The onchain lease settles at term end."""
        if lease and lease.key_dir:
            shutil.rmtree(lease.key_dir, ignore_errors=True)

    def _fund(self, quote: dict) -> str:
        deposit = int(quote["maximum_escrow"])
        duration = int(quote["duration_seconds"])
        client_ref = Web3.keccak(text=quote["quote_id"])
        node_id = bytes.fromhex(quote["node_id"].removeprefix("0x"))
        allowance = self._usdg.functions.allowance(self.address, self.escrow).call()
        if allowance < deposit:
            self._send(self._usdg.functions.approve(self.escrow, deposit))
        return self._send(
            self._escrow.functions.createLease(node_id, duration, client_ref),
            confirmations=CONFIRMATIONS,
        )

    def _send(self, call: object, confirmations: int = 1) -> str:
        tx = call.build_transaction(
            {
                "from": self.address,
                "nonce": self.w3.eth.get_transaction_count(self.address),
                "chainId": CHAIN_ID,
            }
        )
        signed = self.account.sign_transaction(tx)
        h = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(h)
        if receipt.status != 1:
            raise PrismError(402, "tx_reverted", {"hash": h.hex()})
        if confirmations > 1:
            target = receipt.blockNumber + confirmations - 1
            while self.w3.eth.block_number < target:
                time.sleep(2)
        return h.hex()

    def _proxy(
        self,
        method: str,
        segments: list,
        body: object = None,
        raw: bool = False,
        reauthed: bool = False,
    ):
        if not self.session:
            self.authenticate()
        res = self._request(
            f"/api/agent/proxy/{'/'.join(segments)}",
            method,
            body,
            {"authorization": f"Bearer {self.session}"},
        )
        if res.status_code == 401 and not reauthed:
            self.session = None
            self.authenticate()
            return self._proxy(method, segments, body, raw, True)
        if raw:
            return res.status_code, _safe_json(res)
        return self._unwrap(res)

    def _json(self, method: str, path: str, body: object = None):
        return self._unwrap(self._request(path, method, body))

    def _request(self, path: str, method: str, body: object = None, headers: dict | None = None):
        try:
            return requests.request(
                method,
                f"{self.api_base}{path}",
                json=body,
                headers={"accept": "application/json", **(headers or {})},
                timeout=FETCH_TIMEOUT,
            )
        except requests.RequestException as e:
            raise PrismError(504, "control_plane_unreachable", {"cause": str(e)}) from e

    @staticmethod
    def _unwrap(res):
        data = _safe_json(res)
        if not res.ok:
            code = (data or {}).get("error") or (data or {}).get("code") or "request_failed"
            raise PrismError(res.status_code, code, data)
        return data

    def _generate_ssh_key(self) -> dict:
        directory = tempfile.mkdtemp(prefix="prism-ssh-")
        try:
            key_path = f"{directory}/id_ed25519"
            subprocess.run(
                [
                    "ssh-keygen",
                    "-t",
                    "ed25519",
                    "-N",
                    "",
                    "-q",
                    "-f",
                    key_path,
                    "-C",
                    "prism-agent",
                ],
                check=True,
                capture_output=True,
            )
            with open(f"{key_path}.pub") as f:
                return {"dir": directory, "key_path": key_path, "public_key": f.read().strip()}
        except Exception as e:
            shutil.rmtree(directory, ignore_errors=True)
            raise PrismError(500, "ssh_keygen_failed", {"cause": str(e)}) from e


def _safe_json(res):
    try:
        return res.json()
    except ValueError:
        return None


def _is_ssh_warmup(res: dict) -> bool:
    if res["code"] != 255:
        return False
    e = res["stderr"]
    return (
        e.startswith("ssh: ")
        or "\nssh: " in e
        or "kex_exchange_identification" in e
        or "Connection reset by peer" in e
        or ("Permission denied (publickey" in e and res["stdout"] == "")
    )
