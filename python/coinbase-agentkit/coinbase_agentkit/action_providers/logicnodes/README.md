<img src="https://logicnodes.io/logo-black.jpg" alt="LogicNodes" width="80" />

# LogicNodes Action Provider

Gives any AgentKit agent access to [LogicNodes AOS](https://logicnodes.io) — 624 deterministic compute workers with cryptographic proof-of-logic.

Workers cover **Finance, Healthcare, Legal, Logistics, Aerospace, Cybersecurity, Energy, HR, Compliance, Agriculture, Automotive, Biopharma, Smart Cities**, and more. Every result includes an **EIP-191 Proof-of-Logic** signature — cryptographic proof the computation was performed correctly, not hallucinated.

Pay per call in **USDC via x402** on Base, Arbitrum, Polygon, or Optimism. No account needed.

---

## Quick Start

```python
from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.action_providers.logicnodes import logicnodes_action_provider

kit = AgentKit(AgentKitConfig(
    wallet_provider=your_wallet_provider,
    action_providers=[logicnodes_action_provider()],
))
```

With a pre-paid API key (skips x402 per-call payment):

```python
from coinbase_agentkit.action_providers.logicnodes import logicnodes_action_provider, LogicNodesConfig

kit = AgentKit(AgentKitConfig(
    wallet_provider=your_wallet_provider,
    action_providers=[logicnodes_action_provider(
        LogicNodesConfig(api_key="your-logicnodes-api-key")
    )],
))
```

---

## Available Actions

| Action | Description |
|--------|-------------|
| `discover_logicnodes_workers` | List workers, filter by category or keyword |
| `try_logicnodes_worker_free` | One free call per agent per worker — no payment required |
| `call_logicnodes_worker` | Pay-per-call via x402 USDC or API key |

---

## Example Workers

```python
# Finance — loan amortization
result = await agent.call("call_logicnodes_worker", {
    "worker": "loan_amortization_engine",
    "params": {"principal": 500000, "annual_rate_pct": 7.0, "term_months": 360}
})
# → monthly_payment: 3326.51, total_interest: 697,544.34, proof_of_logic: {...}

# Healthcare — drug interaction check
result = await agent.call("call_logicnodes_worker", {
    "worker": "drug_interaction_oracle",
    "params": {"drug_a": "warfarin", "drug_b": "aspirin", "patient_age": 68}
})

# Legal — AML risk scoring
result = await agent.call("call_logicnodes_worker", {
    "worker": "anti_money_laundering_red_flag_scorer",
    "params": {"transaction_amount": 9500, "frequency_per_month": 8, "jurisdiction": "US"}
})

# Aerospace — rocket staging
result = await agent.call("call_logicnodes_worker", {
    "worker": "rocket_stage_separation_timer",
    "params": {"stage": 1, "altitude_m": 80000, "velocity_ms": 2400,
               "fuel_remaining_kg": 50, "target_orbit_km": 400}
})
```

---

## Free Trial

Every worker supports one free call per agent:

```bash
curl -X POST https://logicnodes.io/free-trial/loan_amortization_engine \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: my-agent-001" \
  -d '{"principal": 300000, "annual_rate_pct": 6.5, "term_months": 360}'
```

---

## x402 Payment Flow

Without an API key, `call_logicnodes_worker` follows the standard x402 two-step flow compatible with AgentKit's built-in x402 provider:

1. POST to `/call/{worker}` → receive `402 Payment Required` with payment options
2. Agent pays in USDC via `retry_http_request_with_x402`
3. Worker executes and returns signed result

---

## Discovery

- **Agent manifest:** `https://logicnodes.io/.well-known/agent.json` (624 workers)
- **LLM-readable:** `https://logicnodes.io/llms.txt`
- **Python SDK:** `pip install logicnodes-m2m`
- **MCP bridge:** `npx @logicnodez/mcp-bridge`

---

## Proof of Logic

Every result includes an EIP-191 cryptographic signature:

```json
{
  "_verification": {
    "algorithm": "EIP-191",
    "signature": "0x1a2b3c...",
    "standard": "Tsiolkovsky Rocket Equation / NASA SP-125",
    "worker": "rocket_stage_separation_timer"
  }
}
```

This proves the computation was deterministic and not hallucinated by an LLM.
