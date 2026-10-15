# x402receipts Action Provider

Gives an AgentKit agent an accounting-grade record of its own x402 spending. Every purchase it records on [x402receipts](https://x402receipts.com) is reconciled against the on-chain payment, anchored with independently verifiable evidence, and shown to the finance team as a monthly statement.

## Actions

- `get_x402receipts_info` — endpoint, price and payment options. Pays nothing.
- `record_x402_receipts` — record 1–500 purchases as receipts. USD 1 per wallet per calendar month, paid by the agent's wallet over x402 (USDC on Base or Solana); unlimited receipts. The paying wallet becomes the account; its owner signs in with the same wallet.
- `verify_x402_receipt` — public verification material for one receipt (hash, Merkle path, Hedera ledger entry). Pays nothing.

## Usage

```typescript
import { x402receiptsActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [x402receiptsActionProvider()],
});
```

No API key. Supported networks: base-mainnet, base-sepolia, solana-mainnet, solana-devnet.

Docs: https://app.x402receipts.com/llms.txt · OpenAPI: https://app.x402receipts.com/openapi.json
