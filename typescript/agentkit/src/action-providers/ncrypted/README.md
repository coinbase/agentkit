# ncrypted Action Provider

This directory contains the **NcryptedActionProvider**, which lets an agent share secrets (passwords, API keys, tokens, private notes) as one-time, end-to-end encrypted links through [ncrypted](https://ncrypted.ai), instead of pasting the value into chat or a message.

## Directory Structure

```
ncrypted/
├── ncryptedActionProvider.ts         # Main provider
├── ncryptedActionProvider.test.ts    # Tests (including wire-compatibility vectors)
├── crypto.ts                         # ncrypted v1 envelope (AES-256-GCM + HKDF/PBKDF2)
├── schemas.ts                        # Action schemas and config
├── index.ts                          # Exports
└── README.md
```

## Actions

- `create_secret`: encrypts a value locally and returns a link that opens exactly once (optionally emailed).
- `read_secret`: opens a link, returns the value, and destroys the secret.
- `secret_status`: tells the creator whether the link has been opened.

## How it works

- The value is encrypted in the agent's process with AES-256-GCM. The decryption key exists only in the link's `#fragment`, so the ncrypted service stores ciphertext only.
- The first read deletes the secret atomically; unread links expire (5 minutes to 7 days).
- The first 3 secrets per day are free. After that each costs 0.005 USDC on Base, paid via x402 from the agent's wallet. Payments are capped at `maxPaymentUsdc` (default 0.01) per secret. Reading and status checks are free.

## Configuration

```typescript
import { AgentKit, ncryptedActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [ncryptedActionProvider({ maxPaymentUsdc: 0.01 })],
});
```

Optional environment variable: `NCRYPTED_URL` to point at a different ncrypted deployment.

## Network Support

Base mainnet (payments settle in USDC on Base).

## Notes

- Agents should share only the link, never the secret value itself; the action descriptions instruct the model accordingly.
- Wire format and API: https://ncrypted.ai/llms.txt. Reference implementation: https://github.com/Seidl-Family/ncrypted
