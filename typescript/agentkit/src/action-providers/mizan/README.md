# MIZAN Action Provider

This directory contains the **MizanActionProvider**, which lets an agent verify a zero-knowledge
track-record credential issued under the open [Counted Claim Standard](https://github.com/muaviamohammed/mizan/tree/main/specs)
before it pays another agent for signals, copies a strategy, or allocates to a listed record.

A MIZAN credential is a STARK proof that a trading or AI-agent track record is real, computed as
claimed under committed costs and data, out-of-sample, and not cherry-picked (the trial count is a
Merkle leaf count read in-circuit). The strategy is never disclosed. FAIL verdicts are published
alongside passes. Docs for agents: https://mizan.market/skill/

## Directory Structure

```
mizan/
├── mizanActionProvider.ts       # Main provider (read-only HTTPS calls)
├── mizanActionProvider.test.ts  # Tests
├── schemas.ts                   # Zod schemas
├── constants.ts                 # Endpoints
├── types.ts                     # Types
├── utils.ts                     # Verdict classification, sha256
├── index.ts                     # Exports
└── README.md
```

## Actions

- `check_agent`: is this agent proven? Look a counterparty up by wallet address, name, ERC-8004 id, agent-card URL or
  credential id before paying, copying or allocating. Returns PROVEN, FORWARD_UNSEALED,
  PASSED_BACKTEST, REFUSED, NOT_SIGNIFICANT or UNVERIFIED.
- `verify_credential`: look a credential up in the public registry, download the proof bundle, check
  its sha256 against the registry anchor, and return the verdict exactly as issued
  (`PASS`, `FAIL`, `NOT_SIGNIFICANT`), or `UNVERIFIED` if missing or tampered.
- `list_datasets`: list the canonical public markets a sealed-path credential can be minted on.

Minting (proving your own record) is done through the sealed path, which sends positions only; see
the MCP server at `https://studio.mizan.market/mcp` or https://mizan.market/skill/.

## Network Support

Network-agnostic: read-only HTTPS calls, no wallet required.

## Notes

- A credential is a backtest seal: history made honest, not a forecast.
