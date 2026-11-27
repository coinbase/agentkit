# Solana Rent & Rug Shield Action Provider

Read-only, non-custodial Solana token safety and empty-ATA rent recovery preview actions powered by [https://rentandrugshield.com](https://rentandrugshield.com):

- `check_token_rug_shield`: 11-layer pre-buy rug and scam audit on a Solana token mint (`pubkey` only).
- `scan_wallet_unclaimed_rent`: Previews reclaimable rent-exempt SOL locked in empty SPL and Token-2022 Associated Token Accounts (`0%` fee on first claim).

Neither action reads, accepts, or transmits private keys or seed phrases, and nothing is signed or broadcast.

```typescript
import { rentshieldActionProvider } from "@coinbase/agentkit";

const actionProviders = [rentshieldActionProvider()];
```
