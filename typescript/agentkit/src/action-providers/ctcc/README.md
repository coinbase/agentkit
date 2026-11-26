# CTCC Action Provider

Action provider for **CTCC™ (Cinqueport Token Control Check)**, providing deterministic smart-contract authority and control inspection for AI agents on **Base Mainnet (`eip155:8453`)**.

Settles via open **x402 v2 micropayments** ($0.01 USDC on Base to `0x14d4035290a31B81E99e2DEE26ef0a10e5Aa4d75`).

## Actions

- `check_token_control`: Discovers contract bytecode presence, ERC-20 metadata, active owner/admin addresses, pausable state, and EIP-1967 proxy mechanisms. Returns structured JSON facts with zero subjective bias.

## Usage

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { ctccActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    ctccActionProvider()
  ]
});
```
