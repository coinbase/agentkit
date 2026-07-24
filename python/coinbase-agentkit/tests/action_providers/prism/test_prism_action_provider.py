"""Tests for the Prism action provider."""

from unittest.mock import MagicMock

from coinbase_agentkit.action_providers.prism.client import Lease
from coinbase_agentkit.action_providers.prism.prism_action_provider import prism_action_provider


def test_wallet_formats_balances():
    """Wallet returns the address and formatted USDG balance."""
    client = MagicMock()
    client.balances.return_value = {
        "address": "0xEcaaE714912C38fA7e0dAF78afa7C54DbeD11039",
        "usdg": 920362,
        "eth": 4506706341389206,
    }
    out = prism_action_provider(client).wallet({})
    assert "0xEcaaE714912C38fA7e0dAF78afa7C54DbeD11039" in out
    assert "0.920362 USDG" in out


def test_list_gpus_formats_offers():
    """list_gpus renders model, VRAM, and hourly price."""
    client = MagicMock()
    client.offers.return_value = [
        {"gpu": {"model": "L40S", "vram_mib": 46068}, "rate_per_second": 222}
    ]
    out = prism_action_provider(client).list_gpus({})
    assert "L40S" in out
    assert "46068 MiB" in out
    assert "/hr" in out


def test_list_gpus_empty():
    """list_gpus reports when no GPUs are online."""
    client = MagicMock()
    client.offers.return_value = []
    assert "No GPUs" in prism_action_provider(client).list_gpus({})


def test_lease_and_run_returns_receipt_and_output():
    """lease_and_run funds a lease, runs the command, and returns both."""
    client = MagicMock()
    client.lease.return_value = Lease(
        lease_id=12,
        access={},
        key_path="/tmp/k",
        key_dir="/tmp/k.d",
        public_key="ssh-ed25519 AAAA",
        funding_hash="0xabc123",
        quote={},
    )
    client.run.return_value = {"code": 0, "stdout": "NVIDIA L40S", "stderr": ""}
    out = prism_action_provider(client).lease_and_run(
        {"command": "nvidia-smi", "duration_seconds": 600, "max_usdg": 0.5}
    )
    assert "lease 12" in out
    assert "0xabc123" in out
    assert "NVIDIA L40S" in out
    client.lease.assert_called_once()


def test_run_without_active_lease():
    """Run reports when the lease id is not held in this session."""
    client = MagicMock()
    out = prism_action_provider(client).run({"lease_id": 999, "command": "ls"})
    assert "No active lease" in out


def test_end_lease_without_active_lease():
    """end_lease reports when the lease id is not held in this session."""
    client = MagicMock()
    out = prism_action_provider(client).end_lease({"lease_id": 999})
    assert "No active lease" in out


def test_supports_network():
    """The provider supports any network since it uses its own wallet."""
    assert prism_action_provider(MagicMock()).supports_network(MagicMock()) is True
