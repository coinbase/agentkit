# Foundry Action Provider

This directory contains the **FoundryActionProvider**, which gives agents a catalog of pay-per-call tools from [Foundry](https://minty-sprout.onrender.com), paid in USDC on Base over x402.

Tools include contract facts, transaction explanations, token info, DNS/WHOIS/SSL checks, page metadata, OCR, translation and summaries. Calls cost $0.001 to $0.10, and failed calls are not charged.

## Directory Structure

```
foundry/
├── foundry_action_provider.py   # Main provider
├── schemas.py                   # Action schemas
├── __init__.py                  # Main exports
└── README.md                    # This file
```

## Actions

- `list_foundry_tools`: list tools with price and expected input (free), optionally filtered by keyword
- `call_foundry_tool`: call a tool by id with an input string, paying over x402

## Configuration

```python
from coinbase_agentkit import foundry_action_provider

provider = foundry_action_provider(max_payment_usdc=0.01)
```

Environment variables: `FOUNDRY_BASE_URL` (server URL) and `FOUNDRY_MAX_PAYMENT_USDC` (per-call limit, default 0.05).

## Network Support

Base mainnet only (USDC).
