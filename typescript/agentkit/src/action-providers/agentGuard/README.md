# AgentGuard Action Provider

`AgentGuardActionProvider` provides fail-closed pre-flight transaction security, spend ceilings, prompt injection scanning, and x402 payment validation for EVM agents on Base and other EVM networks.

## Features

- **Validate Transaction:** Pre-flight inspection of planned onchain transactions, catching:
  - Blocklisted destination addresses (zero address, burn addresses, known drainers).
  - Unbounded ERC-20 approvals (`approve(spender, 2^256-1)`).
  - Dangerous selectors (ownership hijacking, proxy upgrades, self-destruct).
  - Exceeded per-transaction and 24-hour cumulative spend limits.
- **x402 Payment Challenge Verification:** Validates HTTP 402 challenges against Base USDC caps to prevent API overcharging.
- **Prompt Safety Scanner:** Evaluates user instructions and reasoning traces for jailbreak patterns and drain attempts.
- **Customizable Boundaries:** Supports custom ceilings, strict mode toggles, and address blocklists.

## Installation & Setup

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { agentGuardActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider: evmWalletProvider,
  actionProviders: [
    agentGuardActionProvider({
      maxNativePerTx: "0.05", // 0.05 ETH per tx
      maxNativeDaily: "0.20", // 0.20 ETH daily
      maxUsdcPerTx: "50.0",   // 50 USDC per tx
      maxPaymentPerX402: "5.0", // 5 USDC per x402 challenge
    }),
  ],
});
```
