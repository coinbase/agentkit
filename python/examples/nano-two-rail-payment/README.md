# AgentKit Two-Rail Payment Example — Nano (XNO) beside EVM/USDC

A minimal, runnable example of an **agent-wallet settling the same payment on
two rails behind one interface**: the **Nano (XNO)** rail and the **EVM /
Base USDC** rail.

This is the exact "documented adapter with a working example" shape a wallet
SDK gets when it adds a Nano entry next to an EVM/USDC one.

## Why

Every agent-wallet SDK that supports x402 today settles on EVM/Base USDC (or
Solana) only. **Nano (XNO)** is a feeless, sub-second-finality, self-custodial
rail — no per-transfer gas, no freezeable stablecoin, no off-chain channel or
liquidity management — which fits a budget-bound, per-call agent economy.

## What it does

`two_rail_payment.py` settles a $1.00 x402-priced call on the **Nano rail**
through `NanoWalletProvider.native_transfer` (the *same* `WalletProvider`
interface AgentKit exposes for EVM and Solana), quotes the **USDC/EVM rail**
with its real fee + gas profile, and prints machine-readable markers:

```
RAIL:nano FEE_USD:0.000000 FINALITY_S:0.3
RAIL:usdc FEE_USD:0.060000 FINALITY_S:3.0
TWO_RAILS:OK NANO_FEE:0.000000 USDC_FEE:0.060000
```

## Run

No wallet, no keys — the Nano rail settles through a documented in-memory RPC
seam, so the example runs out of the box (and on CI):

```bash
python3 two_rail_payment.py
```

To exercise the real Nano RPC code path, point `NANO_RPC_URL` at a live node
and set `NANO_ADDRESS` / `TO_NANO`:

```bash
NANO_RPC_URL=https://rpc.nano.to python3 two_rail_payment.py
```

The EVM rail is intentionally quote-only here: a live USDC settlement needs an
EVM-funded `EthAccountWalletProvider`, which requires network keys this example
deliberately does not ship.
