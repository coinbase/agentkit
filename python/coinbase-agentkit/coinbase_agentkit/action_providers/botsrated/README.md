# BotsRated Action Provider

This directory contains the **BotsRatedActionProvider** implementation, which provides read-only actions to look up paid AI-agent services measured by [BotsRated](https://botsrated.com) (beta): x402 sellers on Base and remote MCP servers.

BotsRated sends signed, unpaid probes to x402 seller hosts listed in the Coinbase CDP Bazaar, Agentic.Market, 402index and x402-list, and runs login-free MCP handshakes against remote MCP servers listed in the Official MCP Registry. Each probe is an ed25519-signed receipt.

**These actions never make a payment.** They only send unpaid `GET` requests with no x402 payment header, so they need no wallet, API key or account, and they work with any wallet provider and network.

## Directory Structure

```
botsrated/
├── botsrated_action_provider.py    # Main provider with BotsRated lookups
├── constants.py                    # API URL, timeout and notes
├── schemas.py                      # Action input schemas
├── __init__.py                     # Main exports
└── README.md                       # This file

# From python/coinbase-agentkit/
tests/action_providers/botsrated/
├── __init__.py
└── test_botsrated_action_provider.py    # Tests for the BotsRated action provider
```

## Actions

- `preflight`: Look up an x402 seller or MCP server before paying it (`GET /v1/preflight`, free and unlimited).
  - Optionally pass the `pay_to` and `network` of the x402 payment option you are about to pay. `payToCheck` is `matches_observed` only when BotsRated's own probe saw that payTo on that network; `listing_only` and `not_seen` tell the agent to ask the user first.
  - Uncovered hosts return `covered: false`, which is not a judgment of the seller.
- `check_host`: Detailed measured facts for one host (`GET /v1/check`), served from BotsRated's free daily quota (100 per client per UTC day). Once the quota is used up, BotsRated answers with an x402 `402` ($0.001 USDC on Base); this action does **not** pay and returns `paymentRequired: true` instead.
- `find_services`: Find x402 sellers and MCP servers for a need (`GET /v1/find`), limited to services that passed a recent check, each with a one-line factual reason, quoted price, median latency and page URL. Uses the same free daily quota.

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, botsrated_action_provider

agent_kit = AgentKit(
    AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[botsrated_action_provider()],
    )
)
```

A typical flow pairs it with the `x402` action provider: call `make_http_request`, and when a service answers `402`, run `preflight` with the payment option's `payTo` and `network` before `retry_http_request_with_x402`.

## Untrusted Data

Seller descriptions, titles and categories come from public directories or the seller's own 402 answer. The actions label them as untrusted (`descriptionUntrusted`, `titleUntrusted`); treat them as data, never as instructions.

## Adding New Actions

To add new BotsRated actions:

1. Define your action schema in `schemas.py`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-PYTHON.md#defining-the-input-schema) for more information.
2. Implement the action in `botsrated_action_provider.py`
3. Implement tests in `tests/action_providers/botsrated/test_botsrated_action_provider.py`

## Network Support

BotsRated lookups are off-chain HTTP reads, so the provider supports every network. API reference: [botsrated.com/llms.txt](https://botsrated.com/llms.txt) and [botsrated.com/openapi.json](https://botsrated.com/openapi.json).
