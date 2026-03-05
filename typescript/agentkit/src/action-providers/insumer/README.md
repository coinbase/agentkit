# Insumer Action Provider

This directory contains the InsumerAPI action provider implementation, which provides actions for privacy-preserving on-chain wallet verification, trust profiling, and discount code validation across 32 chains (30 EVM + Solana + XRPL).

## Directory Structure

```
insumer/
├── constants.ts                     # API base URL and error messages
├── insumerActionProvider.test.ts    # Tests for the provider
├── insumerActionProvider.ts         # Main provider with InsumerAPI functionality
├── index.ts                         # Main exports
├── README.md                        # Documentation
├── schemas.ts                       # Zod input schemas for all actions
└── types.ts                         # TypeScript interfaces for API responses
```

## Setup

1. Get a free API key at [insumermodel.com/developers](https://insumermodel.com/developers/)
2. Set the `INSUMER_API_KEY` environment variable, or pass `apiKey` in the config

```typescript
import { insumerActionProvider } from "@coinbase/agentkit";

// Via environment variable
const provider = insumerActionProvider();

// Via config
const provider = insumerActionProvider({ apiKey: "insr_live_..." });
```

## Actions

- `verify_wallet`: Verify on-chain wallet conditions with boolean attestations

  - Checks token balances, NFT ownership, EAS attestations, Farcaster IDs
  - Returns ECDSA-signed booleans, never raw balances
  - Supports compliance templates (e.g. `coinbase_verified_account`)
  - 1 credit per call (2 with Merkle proofs)

- `get_wallet_trust_profile`: Generate a wallet trust profile

  - 17 checks across 4 dimensions: stablecoins, governance, NFTs, staking
  - ECDSA-signed and independently verifiable
  - 3 credits per call (6 with Merkle proofs)

- `get_batch_wallet_trust_profiles`: Batch trust profiles for up to 10 wallets

  - 5-8x faster than sequential calls
  - Supports partial success
  - 3 credits per wallet

- `validate_discount_code`: Validate an INSR-XXXXX discount code

  - No API key required (public endpoint)
  - Returns validity, discount percentage, and expiration

- `list_compliance_templates`: List available EAS compliance templates
  - No API key required (public endpoint)
  - Coinbase Verifications and Gitcoin Passport templates

## Supported Chains

30 EVM chains: Ethereum, BNB Chain, Base, Avalanche, Polygon, Arbitrum, Optimism, Chiliz, Soneium, Plume, World Chain, Sonic, Gnosis, Mantle, Scroll, Linea, zkSync Era, Blast, Taiko, Ronin, Celo, Moonbeam, Moonriver, Viction, opBNB, Unichain, Ink, Sei, Berachain, ApeChain. Plus Solana and XRPL (32 total).

## Pricing

- Free tier: 100 credits, no credit card required
- 25 credits per 1 USDC ($0.04/credit)
- Attestation: 1 credit (2 with Merkle proofs)
- Trust profile: 3 credits (6 with Merkle proofs)
- Public endpoints (validate_discount_code, list_compliance_templates): free

## Links

- [Developer Documentation](https://insumermodel.com/developers/)
- [API Reference](https://insumermodel.com/developers/api-reference/)
- [OpenAPI Spec](https://insumermodel.com/openapi.yaml)
- [MCP Server](https://www.npmjs.com/package/mcp-server-insumer)
- [LangChain Integration](https://pypi.org/project/langchain-insumer/)

## Examples

### Verifying Coinbase KYC Status

```
Prompt: "Check if wallet 0xd8dA...96045 has Coinbase KYC verification on Base"

The agent will call verify_wallet with:
- wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
- conditions: [{ type: "eas_attestation", template: "coinbase_verified_account" }]
```

### Getting a Wallet Trust Profile

```
Prompt: "What's the trust profile for vitalik.eth?"

The agent will call get_wallet_trust_profile with:
- wallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

### Batch Trust Profiling

```
Prompt: "Compare trust profiles for these 3 wallets: 0xd8dA..., 0xAb58..., 0x7a25..."

The agent will call get_batch_wallet_trust_profiles with:
- wallets: [{ wallet: "0xd8dA..." }, { wallet: "0xAb58..." }, { wallet: "0x7a25..." }]
```
