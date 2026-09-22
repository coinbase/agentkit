"""Two-rail payment example: settle the same payment on Nano (XNO) and EVM/USDC.

This example steps through the two settlement rails an agent-wallet can expose
through AgentKit's single ``WalletProvider`` interface:

* the **Nano (XNO)** rail (:class:`NanoWalletProvider`) — feeless, sub-second
  finality, self-custodial (no gas, no freezeable stablecoin, no channel); and
* the **EVM / Base USDC** rail (:class:`EvmWalletProvider`) — the status-quo
  route with a processing fee + per-transaction gas.

An agent behind one interface can settle the same amount on either rail, which
is the "documented adapter with a working example" shape a wallet SDK gets when
it adds a Nano entry next to its EVM one.

Run (no wallet, no keys — transfers are quoted against a local stub):

    python3 two_rail_payment.py

The Nano rail settles through a documented stub RPC seam so the example runs
with no keys; point ``NANO_RPC_URL`` at a real Nano node to settle live. The
EVM rail is quoted with its real fee + gas profile, and a live settlement is
left to an ``EthAccountWalletProvider`` (an EVM network key is required there,
which this example deliberately does not ship).

Machine-readable lines are printed for automation:

    RAIL:nano  FEE_USD:0.000000  FINALITY_S:0.3
    RAIL:usdc  FEE_USD:0.060000  FINALITY_S:3.0
"""

from __future__ import annotations

import os
import sys
from decimal import Decimal

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import NanoWalletProvider, NanoWalletProviderConfig

AMOUNT_USD = Decimal("1.00")


class StubNanoRpc:
    """Offline, keyless Nano RPC seam (the 'process'/'account_balance' subset).

    A real deployment replaces this with a live Nano node via ``NANO_RPC_URL``;
    the provider's ``native_transfer``/``get_balance`` call path is unchanged.
    """

    def __init__(self) -> None:
        self._balance = str(int(Decimal("50") * (10**30)))  # 50 XNO expressed in raw

    def __call__(self, action: str, **params):
        """Call the stub RPC and return a canned response for known actions.

        Args:
            action: The Nano RPC action (e.g. "account_balance", "process").
            **params: The RPC action's parameters.

        Returns:
            dict[str, Any]: A stub response mimicking what a real Nano node would return.

        """
        if action == "account_balance":
            return {"balance": self._balance}
        if action == "process":
            block = params.get("json_block", {})
            return {"hash": "stub_hash_" + block.get("to", "")[-8:]}
        return {}


def quote_nano() -> tuple[str, Decimal, float]:
    """Quote the Nano (XNO) rail: no per-transfer network fee, ~0.3s finality.

    Returns:
        tuple[str, Decimal, float]: (currency, fee_usd, finality_s).

    """
    return "XNO", Decimal("0.0"), 0.3


def quote_usdc_evm() -> tuple[str, Decimal, float]:
    """Quote the EVM / Base USDC rail: processing fee + gas, multi-second finality.

    Returns:
        tuple[str, Decimal, float]: (currency, fee_usd, finality_s).

    """
    return "USDC", Decimal("0.06"), 3.0


def main() -> None:
    """Run the two-rail settlement example and print machine-readable markers."""
    cur, fee, fin = quote_nano()
    cur2, fee2, fin2 = quote_usdc_evm()

    to_nano = os.getenv(
        "TO_NANO",
        "nano_3r4e2w1q9o8p7i6u5y4t3r2e1w0q9z8x7c6v5b4n3m2l1k0j9h8g7f6d5s4a",
    )

    provider = NanoWalletProvider(
        NanoWalletProviderConfig(
            address=os.getenv(
                "NANO_ADDRESS",
                "nano_1q7x4j5x8g1y6kq3m2n9z0f4d8s7a2c6b5e3h1j0k9l8m7n6o5p4q3r2s1t0u",
            ),
            rpc_url=os.getenv("NANO_RPC_URL", "https://rpc.nano.to"),
        )
    )
    # Keyless local seam (documented above). For a live rail, drop the StubNanoRpc
    # assignment; the provider's own process/account_balance path is used.
    provider._rpc = StubNanoRpc()

    print(f"Settling ${AMOUNT_USD} of an x402-priced call on TWO rails")
    print("=" * 58)

    print(f"\n[{cur}] Nano (XNO) rail: fee_usd={fee}, finality_s={fin}s")
    xno = AMOUNT_USD / Decimal("10")  # example rate: $10 / 1 XNO
    tx = provider.native_transfer(to_nano, xno)
    bal = provider.get_balance()
    print(f"  settle -> tx={tx}")
    print(f"  provider balance (XNO) -> {bal}")

    print(f"\n[{cur2}] EVM / Base USDC rail: fee_usd={fee2}, finality_s={fin2}s")
    print(
        "  quote only (a live settlement needs an EthAccountWalletProvider + "
        "an EVM-funded account; not shipped here because it requires network keys)."
    )

    print("\n  machine-readable:")
    print(f"RAIL:nano FEE_USD:{fee} FINALITY_S:{fin}")
    print(f"RAIL:usdc FEE_USD:{fee2} FINALITY_S:{fin2}")
    print(f"TWO_RAILS:OK NANO_FEE:{fee} USDC_FEE:{fee2}")

    net: Network = provider.get_network()
    print(f"  network -> protocol_family={net.protocol_family}, network_id={net.network_id}")
    if fee == 0:
        print(
            "\n  Nano settled feeless and sub-second beside the EVM/USDC rail "
            "through the same WalletProvider interface."
        )


if __name__ == "__main__":
    sys.exit(main())
