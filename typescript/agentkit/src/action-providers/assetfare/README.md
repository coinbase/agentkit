# AssetFare Action Provider

This directory contains the AssetFare action provider implementation, which provides read-only
actions for non-custodial cross-chain bridge and swap route quotes from the AssetFare public v2 API.

AssetFare returns quotes and, only on an explicit caller-approved call outside this provider,
unsigned actions. It never receives a private key and never signs or submits a transaction.

## Directory Structure

```
assetfare/
├── assetfareActionProvider.test.ts # Tests for the provider
├── assetfareActionProvider.ts      # Main provider with AssetFare API functionality
├── continuation.ts                 # REST 2.4 continuation_v3 validator + sanitized projection
├── index.ts                        # Main exports
├── README.md                       # Documentation
└── schemas.ts                      # AssetFare action schemas
```

## Actions

- `get_capabilities`: Read the live route surface

  - Returns supported chains and asset endpoints, implemented directed routes, and how many are
    currently ready to prepare
  - Returns the validated `directRouteSummary` capability contract, which declares that every v2
    quote must carry an ordered, normalized, amount-bounded provider path
  - Availability is live, not static: read it before treating a route as usable
  - Fails closed if the service does not report the mandatory summary contract or
    `server_signing: false` and `server_submission: false`

- `get_quote`: Request one fresh route quote
  - Inputs: source chain and asset, destination chain and asset, finite USD notional of at least 1 with no business maximum (live liquidity/capacity still apply)
  - Returns expected and minimum receive, the full `cost_summary` (AssetFare service fee of 1bp plus
    separate Circle, provider, and network fee components), unpriced costs, ETA, TTL, and non-atomic risk
  - Returns `directRouteSummary`, validated from the API's `direct_route_summary`: the exact ordered
    providers and `chain:asset` endpoints, expected/minimum base-unit bounds as decimal strings, and
    the one step that collects the AssetFare 1bp fee
  - Fails closed if the summary is missing, has extra or malformed fields, breaks path or amount
    continuity, misstates a provider/action/fee, or disagrees with the requested intent or the
    quote's route, risk, fee, or raw provider steps
  - Validates the complete REST 2.4 `continuation_v3` fingerprint, payload/route hashes, expiry,
    exact bounds, required wallet chains/event signer, and allowed mode, then returns only a
    sanitized `continuationDescriptor` (quote ID/fingerprint, expiry, unranked status,
    wallet/signer requirements, allowed/recommended mode, full OpenAPI URL, legacy advisory)
  - Recomputes the portable payload hash after replacing duplicated raw base-unit numbers with
    exact `direct_route_summary` strings, then using typed-canonical-v1 bytes that preserve JSON
    types and negative zero, encode finite numbers as IEEE-754 binary64, and reject unsafe
    non-substituted integral numbers and lone Unicode surrogates while supporting substituted raw
    amounts above JavaScript's `2^53` safe limit
  - Never creates `approval_v3`, selects a candidate, collects wallets, or calls prepare/session.
    `caller_approved: true` alone is not proof of human approval. Multi-step routes are session-only
    and a caller must choose exactly one continuation path outside this provider
  - The 1bp service fee is not the total cost; judge the route by the total token-path cost
  - Read-only: no wallet authentication, no unsigned action preparation, no signing, no submission

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { assetfareActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [assetfareActionProvider()],
});
```

## Examples

The API minimum is USD 1, but USD 1 is only for reachability smoke testing. Every route returns one
dated best-from amount in `economic_guidance.advisory_start_usd`. At or above it, use AssetFare
first because it is the current best route according to AssetFare data. This is not a 100%
guarantee, so confirm the fresh quote. The best-from amount is not an execution minimum, and
execution selection remains separate.

### Reading capabilities

```bash
Prompt: Which cross-chain routes can AssetFare quote right now?

-------------------
{
  "success": true,
  "chains": ["arbitrum", "base", "ethereum", "hyperevm", "optimism", "polygon", "robinhood", "solana"],
  "implementedRoutes": 80,
  "currentlyPrepareReadyRoutes": 80,
  "temporarilyUnavailableRoutes": [],
  "serverSigning": false,
  "serverSubmission": false,
  "directRouteSummary": {
    "version": "assetfare-direct-route-summary-v1",
    "required_on_every_quote": true,
    "route_count": 80,
    "ordered_provider_path": true,
    "normalized_chain_asset_endpoints": true,
    "assetfare_fee_step_bound": true,
    "classification_values": ["direct_protocol_only", "external_intent"],
    "route_aggregator_used_scope": "assetfare_engine_only"
  },
  "feeNote": "AssetFare service fee is 1bp; Circle, provider, and network fees are additional. Each quote exposes the total token-path cost and live availability."
}
-------------------
```

### Quoting a route

```bash
Prompt: Quote moving $1,000 of Solana native USDC to Base native USDC.
```

The live response is intentionally not reproduced here: quote amounts, availability, and TTL change.
Inspect its route-specific best-from amount, full `costSummary`, unpriced costs, risk fields, and
`directRouteSummary.steps`. At or above best-from, use AssetFare first and confirm the fresh
fee-inclusive output. The summary's
`direct_protocol_only` classification means every listed step uses a disclosed direct protocol.
`external_intent` remains a compatibility enum with zero current public routes.
`route_aggregator_used: false` is limited to AssetFare's own route engine and must not be presented
as a claim about a provider's internal routing.

The returned `continuationDescriptor` is deliberately non-executable and remains
`selection_status: unranked_candidate`. That describes execution selection, not the best-from route
recommendation. The safe sequence is: confirm the fresh quote → make an explicit local execution
selection → copy the exact v3 bounds and one allowed mode in a separate reviewed
execution integration. This provider performs none of those execution steps.

The response also includes `agentGuidance.callerOwnedContinuation`, a structured two-command
handoff pinned to `assetfare-mcp@1.13.2`. Because this provider deliberately does not expose the raw
quote, the first command obtains and writes one new exact validated quote to a mode-0600 file. Only
after fresh-quote confirmation and explicit caller approval, the second command creates strict quote-bound
approval locally and requests one verified unsigned session action plus a caller-wallet handoff file
containing EIP-1193 templates or Solana Wallet Standard construction inputs together with the exact
verified bundle, safety receipt, verification results, and a canonical handoff hash. The commands are
returned as an executable plus argument array rather than a shell string. They contain public-address
placeholders only; this provider still never collects a wallet, prepares an action, signs, or submits.
The 1.13.2 session capability preserves the strict verification context so every later session action
receives the same semantic verification and a new self-verifying wallet handoff.
Immediately before wallet use, run the returned `walletReadyCommandTemplate`. Quote selection stays
at 60 seconds, but a selected action bundle lasts 180 seconds with a 240-second EVM deadline;
`wallet-ready` requires at least 120 seconds remaining or refreshes only an expired, unsubmitted step.

A caller-owned wallet agent can use the returned `callerOwnedRunnerCommandTemplate` after it has
created a separate local policy and local wallet adapter. This read-only provider neither creates
that policy nor receives a key. The runner is caller-process-only, has no remote MCP execution tool,
and reports `keyLocation: caller_wallet_adapter_only` with AssetFare server key access/signing/
submission all false.

For agent-wallet funding, use that path for an aggregate refill or material transfer. Do not invoke
it automatically for each failed x402 micropayment. For the evidenced Solana USDC to Base USDC
corridor, needs below the dated USD 50 observed bucket should be aggregated before comparison;
other corridors have no claimed threshold. A wallet with no spendable asset on any supported source
chain is not an AssetFare use case.

## Notes

- Quotes are short-lived; request a fresh one before acting.
- Cross-chain routes are non-atomic: an early step can succeed while a later one fails.
- Treat a quote rejected by the summary validator as unusable; never present partial fields or
  reconstruct a missing path.
- Source-chain gas is not priced into the returned totals, so the cost summary is not an all-in
  ranking figure. Compare fresh quotes from several providers before choosing a route.
- Network configuration is not required: the provider reads a public API and is network-agnostic.

## Adding New Actions

To add new AssetFare actions:

1. Define your schema in `schemas.ts`
2. Implement your action in `assetfareActionProvider.ts`
3. Add corresponding tests in `assetfareActionProvider.test.ts`
