# WalletForge x402 — Python AgentKit example

Shows `walletforge_action_provider()` for [WalletForge](https://api.walletforge.app) pay-per-call tools on Base via x402 V2.

| Action | Price |
|--------|-------|
| `fetch_markdown` | 0.05 USDC |
| `normalize_text` | 0.01 USDC |

Standalone package: [mig26-design/walletforge-x402](https://github.com/mig26-design/walletforge-x402) · [TOOL_SPEC](https://github.com/mig26-design/walletforge-x402/blob/main/docs/TOOL_SPEC.md)

**Paid calls spend real Base USDC.** The default example only runs an **unpaid 402** smoke (no key, no spend).

## Requirements

- Python 3.10+
- [uv](https://github.com/astral-sh/uv)

## Install

```bash
cd python/examples/walletforge-x402
uv sync
```

## Unpaid 402 smoke (safe)

```bash
uv run example.py
```

Equivalent curl:

```bash
curl -sS -i -X POST https://api.walletforge.app/v1/fetch-markdown \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

Expect **HTTP 402**, `accepts[0].amount == "50000"`, `payTo == 0xb5F5a86Df5F78ed78920f74a1D7f26368F708E94`.

Skip the live request:

```bash
uv run example.py --skip-unpaid
```

## AgentKit wiring

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, walletforge_action_provider

agent_kit = AgentKit(
    AgentKitConfig(
        wallet_provider=wallet_provider,  # EVM wallet on Base mainnet
        action_providers=[walletforge_action_provider()],
    )
)
```

Signing: AgentKit `wallet_provider.sign_typed_data`, or `BUYER_PRIVATE_KEY` / `X402_BUYER_PRIVATE_KEY`.

Optional: `X402_BASE_URL` (default `https://api.walletforge.app`).

You can also inject the published buyer:

```python
from walletforge_x402 import X402Buyer
from coinbase_agentkit import walletforge_action_provider

provider = walletforge_action_provider(buyer=X402Buyer())
```

```bash
pip install "git+https://github.com/mig26-design/walletforge-x402.git#egg=walletforge-x402[agentkit]"
```

## Optional paid settle (spends 0.05 USDC)

Use a dedicated funded Base EOA. Never commit keys.

```python
from coinbase_agentkit.action_providers.walletforge.client import WalletForgeClient

buyer = WalletForgeClient.from_env()  # BUYER_PRIVATE_KEY
out = buyer.fetch_markdown("https://example.com", max_chars=5000)
print(out.status_code, out.payment_response)
```

Reference settle: [0x5cebbe810ca7208bc85ab0231c59c03dfee967ad3de30f72ee4a753795677afc](https://basescan.org/tx/0x5cebbe810ca7208bc85ab0231c59c03dfee967ad3de30f72ee4a753795677afc) (0.05 USDC to `0xb5F5a86Df5F78ed78920f74a1D7f26368F708E94`).
