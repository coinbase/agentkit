# Beaver Knight Action Provider

This directory contains the **Beaver Knight** action provider. [Beaver Knight](https://www.beaverknight.com) is a trust bureau for autonomous trading agents: it rates agents and vaults on what they actually did with real money on chain (realised P&L read from the venue itself, with a statistical-significance gate), publishes the rating whether or not the subject asked, and attests ratings on Base via [EAS](https://attest.org) from a canister-controlled address that has no private key.

The actions are public, unauthenticated, read-only, and network-agnostic. They give an agent a counterparty check before it pays, delegates to, or copies another agent or vault.

## Directory Structure

```
beaverknight/
├── beaverknightActionProvider.ts       # Main provider
├── beaverknightActionProvider.test.ts  # Tests
├── constants.ts                        # Base URL, sort keys
├── index.ts                            # Main exports
├── README.md                           # Documentation
└── schemas.ts                          # Action schemas
```

## Actions

- `rate_wallet`: Check an address (execution wallet, owner wallet or token; EVM or Solana) against the bureau.

  - Returns score (0-99), level (`strong | solid | fair | unproven | flag`), verdict, and two **separate** lists: `findings` (about the subject) and `limits` (about the bureau's own reach).
  - An unrated address returns `found: false`. That is an absence of evidence, **not** a clean bill of health.

- `get_vault_rankings`: The vaults on the board (Hyperliquid trading vaults, ERC-4626 yield vaults), ranked.

  - Sort by `score` (default), `return`, `sharpe`, `sortino`, `calmar`, `drawdown`, `tvl` or `decisions`; filter by level, venue, minimum TVL.
  - Each vault carries the figures an allocator compares on, including the t-statistic of the edge and whether it clears the significance gate. A `null` figure means unmeasured, never zero.

- `get_integrity_report`: The full Integrity Report for one record (board id, Virtuals ACP id, or address).
  - Every metric, the factor breakdown behind the score, findings and limits, disclosures, recent windows, a "basis" line describing how to re-derive every number from the venue's public API, and provenance, including the on-chain EAS attestation (UID, tx, keyless attester) when one exists.

## Adding to an agent

```typescript
import { AgentKit, beaverknightActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [beaverknightActionProvider()],
});
```

An optional base URL can be passed (`beaverknightActionProvider("https://...")`) for a self-hosted or staging bureau.

## Examples

### Checking a counterparty

```bash
Prompt: before I pay this agent, is 0xa1b6d8efbcb2fb750a84dbc05649fa4968034f04 rated?

-------------------
{
  "version": 1,
  "query": "0xa1b6d8efbcb2fb750a84dbc05649fa4968034f04",
  "found": true,
  "rating": {
    "id": "hlv-pf1-a1b6d8",
    "name": "PF1",
    "score": 99,
    "status": "Strong",
    "level": "strong",
    "verdict": "verified edge",
    "venue": "Hyperliquid",
    ...
  },
  "meaning": "Verified track record, and the edge is statistically distinguishable from luck. This is the strongest verdict we issue.",
  "findings": [],
  "limits": [{ "label": "below size floor", "detail": null }],
  ...
}
```

### A miss

```bash
Prompt: is 0x0000000000000000000000000000000000000001 rated?

-------------------
{
  "found": false,
  "rating": null,
  "meaning": "No Beaver Knight rating exists for this address. That is an ABSENCE OF EVIDENCE, NOT A CLEAN BILL OF HEALTH. ... Do not treat a miss as a pass."
}
```

## Notes

- A tool error ("could not check", e.g. HTTP 503 from the bureau) is **not** the same as `found: false`; the provider keeps the two distinguishable.
- Ratings are a third-party census; no subject pays to be rated, and none can opt out. The bureau publishes what it could not establish alongside what it found.
- API documentation for machines: https://www.beaverknight.com/llms.txt
