# WalletForge Action Provider

This directory contains the **WalletForgeActionProvider**, a community action provider for [WalletForge](https://api.walletforge.app) pay-per-call tools on **Base mainnet** via **x402 V2**.

Agents pay USDC with EIP-3009 `TransferWithAuthorization` (non-custodial; no seller API keys). Settlement is facilitator-sponsored on Base.

Standalone package (optional): [mig26-design/walletforge-x402](https://github.com/mig26-design/walletforge-x402)

Tool schemas: [TOOL_SPEC.md](https://github.com/mig26-design/walletforge-x402/blob/main/docs/TOOL_SPEC.md)

## Directory Structure

```
walletforge/
├── walletforge_action_provider.py  # Main provider (fetch_markdown, normalize_text)
├── client.py                       # Thin x402 V2 buyer (requests + eth-account)
├── schemas.py                      # Action input schemas
├── constants.py                    # API URL, amounts, Base USDC / payTo
├── __init__.py                     # Exports
└── README.md                       # This file

# From python/coinbase-agentkit/
tests/action_providers/walletforge/
├── conftest.py
├── test_walletforge_action_provider.py
└── test_client.py                  # Mocked HTTP only — no live paid settle
```

## Actions

| Action | Endpoint | Price |
|--------|----------|-------|
| `fetch_markdown` | `POST https://api.walletforge.app/v1/fetch-markdown` | **0.05 USDC** (`50000`) |
| `normalize_text` | `POST https://api.walletforge.app/v1/normalize` | **0.01 USDC** (`10000`) |

| | |
|--|--|
| Network | Base mainnet `eip155:8453` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| payTo | `0xb5F5a86Df5F78ed78920f74a1D7f26368F708E94` |
| Facilitator | `https://facilitator.payai.network` |

Discovery: [agent.json](https://api.walletforge.app/.well-known/agent.json) · [x402.json](https://api.walletforge.app/.well-known/x402.json)

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, walletforge_action_provider

agent_kit = AgentKit(
    AgentKitConfig(
        wallet_provider=wallet_provider,  # EVM wallet on Base mainnet
        action_providers=[walletforge_action_provider()],
    )
)
```

Signing (first match):

1. Injected `buyer=` (`WalletForgeClient` or published `walletforge_x402.X402Buyer`)
2. `private_key=` / `BUYER_PRIVATE_KEY` / `X402_BUYER_PRIVATE_KEY`
3. AgentKit `wallet_provider.sign_typed_data`

Optional: `X402_BASE_URL` (default `https://api.walletforge.app`).

```bash
# Optional standalone buyer (same tools)
pip install "git+https://github.com/mig26-design/walletforge-x402.git#egg=walletforge-x402[agentkit]"
```

**Paid calls spend real Base USDC.** Unit tests mock HTTP and must not settle on-chain.

## Unpaid 402 smoke (no spend)

```bash
curl -sS -i -X POST https://api.walletforge.app/v1/fetch-markdown \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

Expect **HTTP 402**, `accepts[0].amount == "50000"`, `payTo == 0xb5F5a86Df5F78ed78920f74a1D7f26368F708E94`.

Python:

```python
from coinbase_agentkit.action_providers.walletforge.client import WalletForgeClient

r = WalletForgeClient.unpaid_challenge(
    "/v1/fetch-markdown",
    {"url": "https://example.com"},
)
assert r.status_code == 402
```

## Network Support

WalletForge settles on **Base mainnet** only (`network_id=base-mainnet` or `chain_id=8453`).

## Adding New Actions

1. Define the schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema).
2. Implement the action in `walletforge_action_provider.py`.
3. Add mocked tests in `tests/action_providers/walletforge/`.
