"""Prism Network action provider."""

import os
from typing import Any

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .client import Lease, PrismClient
from .constants import DEFAULT_ESCROW, USDG_DECIMALS
from .schemas import (
    EndLeaseSchema,
    LeaseAndRunSchema,
    ListGpusSchema,
    RunSchema,
    WalletSchema,
)


def _usdg(micros: int) -> str:
    return f"{int(micros) / 10**USDG_DECIMALS:.6f} USDG"


class PrismActionProvider(ActionProvider[WalletProvider]):
    """Action provider for renting real NVIDIA GPUs through Prism Network.

    The provider holds its own funded wallet (``PRISM_AGENT_KEY``) and settles
    onchain in USDG, so it composes with any AgentKit wallet provider rather than
    spending the agent's primary wallet.
    """

    def __init__(self, client: PrismClient | None = None) -> None:
        """Initialize the provider.

        Args:
            client: A configured PrismClient. If omitted, one is built from the
                ``PRISM_AGENT_KEY`` and ``PRISM_ESCROW`` environment variables.

        """
        super().__init__("prism", [])
        if client is None:
            key = os.getenv("PRISM_AGENT_KEY")
            if not key:
                raise ValueError("PRISM_AGENT_KEY is required (or pass client=)")
            client = PrismClient(key, os.getenv("PRISM_ESCROW", DEFAULT_ESCROW))
        self.client = client
        self._leases: dict[int, Lease] = {}

    @create_action(
        name="wallet",
        description="Show the Prism agent wallet address and its USDG and native balances.",
        schema=WalletSchema,
    )
    def wallet(self, args: dict[str, Any]) -> str:
        """Return the agent wallet address and balances.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: The wallet address and balances, or an error message.

        """
        try:
            b = self.client.balances()
            return (
                f"address: {b['address']}\n"
                f"usdg: {_usdg(b['usdg'])}\n"
                f"eth: {int(b['eth']) / 10**18:.6f}"
            )
        except Exception as e:
            return f"Error fetching wallet: {e!s}"

    @create_action(
        name="list_gpus",
        description="List GPUs available to rent right now, with model, VRAM, and price per hour.",
        schema=ListGpusSchema,
    )
    def list_gpus(self, args: dict[str, Any]) -> str:
        """List available GPU offers.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: One line per available GPU, or a message when none are online.

        """
        try:
            offers = self.client.offers()
            if not offers:
                return "No GPUs are online to rent right now."
            rows = []
            for o in offers:
                gpu = o.get("gpu", {})
                per_hour = int(o.get("rate_per_second", 0)) * 3600 / 10**USDG_DECIMALS
                rows.append(
                    f"{gpu.get('model', 'GPU')} - {gpu.get('vram_mib', '?')} MiB - "
                    f"${per_hour:.2f}/hr"
                )
            return "\n".join(rows)
        except Exception as e:
            return f"Error listing GPUs: {e!s}"

    @create_action(
        name="lease_and_run",
        description=(
            "Rent a GPU, run one command on it, and return the output. Pays onchain in USDG "
            "up to max_usdg. Blocks while the machine provisions, usually one to four minutes."
        ),
        schema=LeaseAndRunSchema,
    )
    def lease_and_run(self, args: dict[str, Any]) -> str:
        """Lease a GPU, run a command, and return the output.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: The lease id, funding transaction, and command output.

        """
        try:
            p = LeaseAndRunSchema(**args)
            lease = self.client.lease(
                image=p.image,
                duration_seconds=p.duration_seconds,
                min_vram_mib=p.min_vram_mib,
                max_deposit=int(p.max_usdg * 10**USDG_DECIMALS),
            )
            self._leases[lease.lease_id] = lease
            res = self.client.run(lease, p.command)
            out = res.get("stdout") or res.get("stderr") or ""
            return (
                f"lease {lease.lease_id} funded onchain (tx {lease.funding_hash}), "
                f"exit {res.get('code')}:\n{out}"
            )
        except Exception as e:
            return f"Error leasing GPU: {e!s}"

    @create_action(
        name="run",
        description="Run another command on a GPU already leased in this session.",
        schema=RunSchema,
    )
    def run(self, args: dict[str, Any]) -> str:
        """Run a command on an existing lease.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: The command output, or an error message.

        """
        try:
            p = RunSchema(**args)
            lease = self._leases.get(p.lease_id)
            if lease is None:
                return f"No active lease {p.lease_id} in this session."
            res = self.client.run(lease, p.command)
            return f"exit {res.get('code')}:\n{res.get('stdout') or res.get('stderr') or ''}"
        except Exception as e:
            return f"Error running command: {e!s}"

    @create_action(
        name="end_lease",
        description="Release a leased GPU session. The onchain lease settles when its term ends.",
        schema=EndLeaseSchema,
    )
    def end_lease(self, args: dict[str, Any]) -> str:
        """Release a lease's local session.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A confirmation, or an error message.

        """
        try:
            p = EndLeaseSchema(**args)
            lease = self._leases.pop(p.lease_id, None)
            if lease is None:
                return f"No active lease {p.lease_id} in this session."
            self.client.end_lease(lease)
            return f"Released lease {p.lease_id}."
        except Exception as e:
            return f"Error ending lease: {e!s}"

    def supports_network(self, network: Network) -> bool:
        """Return True: Prism settles on its own network, independent of the agent's."""
        return True


def prism_action_provider(client: PrismClient | None = None) -> PrismActionProvider:
    """Create a Prism action provider."""
    return PrismActionProvider(client)
