# Grid402 Action Provider

This directory contains the **Grid402ActionProvider** implementation, providing actions for autonomous AI agents to access Brazilian public records, fiscal identities, macroeconomic indicators, calendar math, and network diagnostics with cryptographic secp256k1 oracle proofs and Base network x402 settlement.

## Directory Structure

```
grid402/
├── constants.ts                  # Protocol addresses and default parameters
├── grid402ActionProvider.ts      # Main provider implementation with @CreateAction decorators
├── grid402ActionProvider.test.ts # Comprehensive Jest unit tests
├── schemas.ts                    # Zod input schemas for all actions
├── index.ts                      # Barrel exports
└── README.md                     # Documentation
```

## Actions

The Grid402 action provider exposes 15 specialized actions:

| Action | Description |
|---|---|
| `fetch_cnpj` | Query official Brazilian corporate registry (CNPJ) from Federal Revenue |
| `fetch_cep` | Resolve 8-digit Brazilian postal code (CEP) to full street address and IBGE codes |
| `fetch_forex` | Query official foreign exchange rates (USD, EUR, GBP) to Brazilian Real (BRL) |
| `fetch_crypto` | Query spot cryptocurrency market prices in BRL and USD |
| `fetch_dns` | Query authoritative DNS records (A, AAAA, MX, TXT, NS, CNAME) |
| `fetch_ssl` | Audit TLS or SSL certificates, expiry dates, and cipher suites |
| `fetch_asn` | Inspect Autonomous System Number (ASN) and BGP routing ownership for IP |
| `fetch_indicators` | Fetch official macroeconomic rates (SELIC, CDI, IPCA, IGP-M) |
| `fetch_holidays` | Retrieve national and banking holidays in Brazil |
| `calculate_workdays` | Compute business days and future settlement dates using the ANBIMA calendar |
| `fetch_sanctions` | Query administrative sanctions and debarment in CEIS and CNEP (CGU) |
| `fetch_simples` | Query enrollment and opt-in status in Simples Nacional and MEI |
| `fetch_compliance` | Evaluate comprehensive 360 compliance score (0 to 100) and risk tier |
| `verify_oracle_proof` | Cryptographically verify secp256k1 oracle signature from Grid402 |
| `get_summary` | Retrieve API status, uptime, and active catalog summary |

## Usage Examples

```typescript
import { grid402ActionProvider } from "@coinbase/agentkit";

// Initialize the action provider
const provider = grid402ActionProvider({
  sandbox: true, // Use demo header for testing
});

// Query official corporate registration
const companyInfo = await provider.fetchCnpj({
  cnpj: "00.000.000/0001-91",
});

// Resolve address from postal code
const address = await provider.fetchCep({
  code: "01310-100",
});

// Fetch Brazilian macroeconomic indicators
const indicators = await provider.fetchIndicators({});

// Calculate business days between two financial settlement dates
const workdays = await provider.calculateWorkdays({
  startDate: "2026-01-05",
  endDate: "2026-01-09",
});

// Cryptographically verify oracle response proof
const verification = await provider.verifyOracleProof({
  payload: JSON.parse(companyInfo),
});
```

## Cryptographic Oracle Proofs

Responses from Grid402 include a verifiable `_oracle_proof` object containing:
- Keccak256 hash digest of the response payload
- secp256k1 ECDSA signature
- Official signer wallet address (`0xa31c31069c43ac1c0075a93c325b0dcd7744356c`)
- ISO 8601 UTC timestamp

Agents can independently verify data provenance without relying on blind trust.

## Network Support

Grid402 data querying is network-agnostic and functions across all chains. When micropayments are required, settlement is executed in USDC on Base mainnet or Base Sepolia.

