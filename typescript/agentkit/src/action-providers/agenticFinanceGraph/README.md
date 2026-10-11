# Agentic Finance Graph Action Provider

This directory contains the **AgenticFinanceGraphActionProvider**, which gives an agent read-only access to [Agentic Finance Graph](https://agenticfinancegraph.com): an independent ledger of money held and spent by ERC-8004 agents on Base.

It answers the question an agent should ask before it pays another agent or an x402 endpoint: has this counterparty actually done anything with money? The answers come from observed payments. The ledger follows every ERC-8004 registration on Base to the wallet bound to it and reads each payment's receipt. Routing hops and history from before an agent was registered are excluded from spending, and every figure carries its measurement time and a published definition.

The provider needs no API key and no wallet access, and none of its actions can move funds.

## Directory Structure

```
agenticFinanceGraph/
├── agenticFinanceGraphActionProvider.ts      # Main provider with the four actions
├── agenticFinanceGraphActionProvider.test.ts # Tests for the provider
├── constants.ts                              # API URL, liveness levels and headline figures
├── index.ts                                  # Main exports
├── README.md                                 # This file
├── schemas.ts                                # Action input schemas
├── types.ts                                  # Configuration and API response types
├── utils.test.ts                             # Tests for the helpers
└── utils.ts                                  # Request, sanitizing and formatting helpers
```

## Configuration

```typescript
import { AgentKit, agenticFinanceGraphActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [agenticFinanceGraphActionProvider()],
});
```

Every action works on the free tier without configuration. Optional settings:

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | `AGENTIC_FINANCE_GRAPH_API_KEY` | API key or Desk session token for the full data tier |
| `baseUrl` | `https://agenticfinancegraph.com` | API base URL |
| `timeoutMs` | `15000` | Timeout for each request, in milliseconds |

## Actions

- `check_agent`: Check an ERC-8004 agent on Base before trusting or paying it
  - Accepts the agent's token id (`57657`), its slug (`8004-base-57657`) or its bound wallet address
  - Returns its liveness level (L7: observed paying a different address after registration; L8: still funded; L9: three or more counterparties in 30 days), its bound wallet and how the binding was established, its stablecoin balance, its counted payments, open incidents and most recent detections
  - An agent never observed paying returns `ranked: false`, which describes its history and is not a fraud verdict

- `get_agent_statement`: Fetch an agent's latest signed 3-hour statement and evaluate it
  - Returns payments out, split into counted spend and routing hops, what left the agent's control, income in and open flags, in USD
  - `check_before_you_pay.passes` is false if the statement is stale (newest window closed more than nine hours ago), its hash chain is broken, or a flag is open
  - Includes the statement hash, Merkle proof and Ed25519-signed root, so the statement can be verified without trusting the ledger

- `check_payee`: Check a payment destination on Base before paying it
  - Accepts a 0x address (for example an x402 `payTo`) or the URL of an x402 resource listed in the x402 Bazaar
  - Returns how many counted payments registered agents made to it, from how many distinct agents and how many of them ranked, first and last payment, what was left out of the count, whether it is a listed x402 seller, and whether the address is itself a ranked agent's wallet

- `get_agent_economy_overview`: The headline figures of AI-agent money on Base
  - ERC-8004 registrations, agents seen paying, still funded and paying repeat counterparties, counted spending and where it went, routing excluded, daily spending, median payment, detections, live incidents and address-poisoning targets
  - Each with its unit, measurement time and definition link

## Examples

### Checking an agent

```
Prompt: Before I hire agent 57657 on Base, what has it actually done with money?

-------------------
{
  "query": "57657",
  "measured_at": "2026-10-11T10:25:38.935Z",
  "ranked": true,
  "token_id": "57657",
  "liveness": {
    "level": "L9",
    "meaning": "L8, and it paid three or more distinct counterparties in the last 30 days."
  },
  "wallet": {
    "address": "0x024beeed33d76cce272c0db022134cda921f4aa6",
    "bound_by": "holds the registration (ERC-721 ownerOf)",
    "binding_confidence": "onchain",
    "stablecoin_balance_usd": 100
  },
  "payments": {
    "count": 793,
    "total_usd": 78564.9,
    "distinct_counterparties": 33,
    "count_30d": 238,
    "usd_30d": 20650.2,
    "last_payment_at": "2026-10-10T15:13:50.177Z"
  },
  "open_incidents": 0,
  "recent_detections": [],
  ...
}
-------------------
```

### Checking a payee before an x402 payment

```
Prompt: The x402 endpoint wants payment to 0x0e84ddedaae6a779c462c22a59f301ec31b6b808. Has any agent paid it before?

-------------------
{
  "address": "0x0e84ddedaae6a779c462c22a59f301ec31b6b808",
  "found": true,
  "paid_by_registered_agents": {
    "counted_payments": 1402,
    "distinct_agents": 180,
    "distinct_ranked_agents": 180,
    "first_paid_at": "2026-02-15T08:07:51.000Z",
    "last_paid_at": "2026-09-26T13:10:55.000Z"
  },
  "x402_seller": { "resources": 15, "calls_30d": 9312 },
  "summary": "180 registered agents (180 of them ranked) made 1402 counted payments to this destination, the latest at 2026-09-26T13:10:55.000Z.",
  ...
}
-------------------
```

## Notes

- Text returned by the API is stripped of control and zero-width characters and length-capped before it reaches the model, and only figures and identifiers the ledger computes are passed through.
- The data is published under CC BY 4.0; quote figures with their measurement time and definition.
- Method and definitions: [agenticfinancegraph.com/def](https://agenticfinancegraph.com/def).
