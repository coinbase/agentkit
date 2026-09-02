# Mizuki Action Provider

This directory contains the Mizuki action provider implementation, which lets an agent quote and track fixed-price maintenance on public GitHub repositories.

Mizuki takes one authorized issue and returns a pull request that passes that repository's own checks, or refunds the quoted amount. Payment is an exact USDC transfer on Solana mainnet with a sponsored fee payer, so a caller needs USDC but not SOL.

## Directory Structure

```
mizuki/
├── constants.ts                 # API base URL and name validation
├── index.ts                     # Main exports
├── mizukiActionProvider.test.ts # Tests for the provider
├── mizukiActionProvider.ts      # Main provider with Mizuki functionality
├── README.md                    # Documentation
└── schemas.ts                   # Mizuki action schemas
```

## Actions

- `quote_maintenance`: Quote fixed-price maintenance for one GitHub issue

  - Price is fixed before payment and pinned to the repository head it was priced against
  - Returns the x402 payment requirements alongside the price
  - Relays the reason an issue was refused rather than reporting a generic failure

- `assess_repository`: Report whether a repository qualifies, and the command Mizuki would run to validate a change

  - Reads the repository's root manifests
  - Not a quote, and reserves nothing
  - Worth calling before quoting, to avoid paying for work Mizuki cannot validate

- `get_job_status`: Read delivery, pull request, validation, and refund state for a job

  - Distinguishes an unknown job from a service failure

- `list_bounties`: List open public maintenance bounties

  - A bounty is opened after an eligible job is fully refunded, so the work is still wanted

## Notes

Paying a quote requires a Solana wallet signature over the x402 challenge, which the caller performs with its own signer. These actions cover the read and quote side of that flow.

Set `apiUrl` when constructing the provider to point at a different Mizuki deployment. It defaults to the public service.

```typescript
import { mizukiActionProvider } from "@coinbase/agentkit";

const provider = mizukiActionProvider();
```

## Network Support

Quoting and reading are HTTP, so the provider supports any network the agent is configured for. Settlement itself happens on Solana mainnet.
