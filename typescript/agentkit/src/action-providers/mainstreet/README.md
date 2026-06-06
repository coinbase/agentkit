# MainStreet Action Provider

This directory contains the **MainStreetActionProvider** — an onchain reputation check for a Base
counterparty before an agent transacts or pays it (e.g. via x402).

[MainStreet](https://avisradar-production.up.railway.app/mainstreet.html) is an onchain reputation
oracle for agent-to-agent payments on Base. For any wallet, agent, or token it returns a
SAFE / CAUTION / BLOCK verdict + a 0–100 score as an **EIP-712-signed attestation, verifiable onchain**
against the MainStreetVerifier contract (`0x7397adb9713934c36d22aa54b4dbbcd70263592b`) — the signal is
checkable, not "trust us". Free, no signup (100 checks/day/IP).

## Actions

- `check_reputation`: Returns the reputation verdict + score for a Base address, with a pay / don't-pay
  recommendation and a link to verify the signed attestation. Use it as a pre-payment / pre-routing
  trust gate — refuse to settle to a BLOCK-rated or unscored counterparty.

## Usage

```typescript
import { mainstreetActionProvider } from "@coinbase/agentkit";

const provider = mainstreetActionProvider();
```

No configuration required (public read API). Pairs naturally with the `x402` and `erc8004` providers.
