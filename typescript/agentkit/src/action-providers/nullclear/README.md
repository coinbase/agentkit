# NullClear Action Provider

The NullClear Action Provider integrates AgentKit wallets with the [NullClear Pre-Execution Security Firewall](https://nullclear.dev) across 7 chains (`base`, `eth`, `arbitrum`, `optimism`, `polygon`, `bsc`, and `solana`).

It works out-of-the-box with zero API keys (10 free calls/day/IP) and optionally accepts a Prepaid Pass key (`nc_live_...`) for high-throughput Bearer authentication and Drop-In Guarded JSON-RPC.

## Directory Structure

```
nullclear/
├── constants.ts                    # NullClear API endpoints and chain lists
├── index.ts                        # Public exports
├── nullclearActionProvider.test.ts # Unit tests
├── nullclearActionProvider.ts      # Action provider implementation
├── README.md                       # Documentation
├── schemas.ts                      # Zod input schemas
├── types.ts                        # Type definitions
└── utils.ts                        # Chain inference, HTTP client, Guarded RPC helper
```

## Actions

- `preflight_guard`: 1-call Pre-Sign Firewall (`POST /v1/guard`) that recursively unwraps Multicall3 / Universal Router / Safe calldata, audits EIP-712 Permits, simulates stateful asset diffs (`eth_simulateV1` / Solana `simulateTransaction`), and scans all touched tokens.
- `scan_token`: 7-chain ERC-20, SPL, and Solana Token-2022 rug-pull, sell-tax, and proxy audit (`GET /v1/scan/:chain/:address`).
- `inspect_contract`: EVM proxy slot resolver (`EIP-1967`, `EIP-1822`, `Beacon`, `Diamond`, `Safe`), Sourcify ABI fetcher, and bytecode risk analyzer (`GET /v1/inspect/:chain/:address`).
- `decode_calldata`: Recursive calldata bundle unwrapper and custom revert decoder (`POST /v1/decode`).
- `simulate_tx`: Stateful preflight simulator (`POST /v1/simulate`) returning predicted balance diffs and revert diagnostics.

## Usage

```typescript
import { AgentKit, nullclearActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    nullclearActionProvider({
      // Optional: omit for zero-key free tier (10 calls/day/IP)
      apiKey: process.env.NULLCLEAR_API_KEY,
    }),
  ],
});
```

### 1-Line Drop-In Guarded JSON-RPC

For automatic network-level protection on every `eth_sendRawTransaction` / `sendTransaction` with zero code changes:

```typescript
import { buildNullClearGuardedRpcUrl } from "@coinbase/agentkit";

const rpcUrl = buildNullClearGuardedRpcUrl({
  chain: "base",
  apiKey: process.env.NULLCLEAR_API_KEY!,
  failMode: "open",
  timeoutMs: 800,
});
```
