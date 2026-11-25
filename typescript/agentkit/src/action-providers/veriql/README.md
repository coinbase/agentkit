# Veriql Action Provider

This directory contains the Veriql action provider. Its actions let an agent check a recipient before it sends money, and check a signing request before it signs. Veriql is read-only: it never requests keys and never moves funds.

## Directory Structure

```
veriql/
├── constants.ts                  # API base URL, default payment cap
├── veriqlActionProvider.test.ts  # Tests for the provider
├── veriqlActionProvider.ts       # Main provider
├── index.ts                      # Main exports
├── README.md                     # Documentation
└── schemas.ts                    # Action schemas
```

## Actions

- `check_payee`: check an address before sending it funds
  - Checks US Treasury OFAC SDN, the Drain Watch list of known drainer and scam addresses, and Tether/Circle freeze status (read from the issuer's contract)
  - Supports EVM, Solana, Bitcoin and Tron addresses
  - Returns `do_not_pay`, `no_known_risk` or `incomplete`

- `check_signature`: check a signing request before signing it
  - Accepts raw calldata, EIP-712 typed data, or a JSON-RPC signing request
  - Decodes approve, Permit, Permit2, EIP-7702 delegation, transfer and revoke
  - Returns `block`, `warn` or `allow`. An undecodable payload returns `block` and is not charged

- `check_denylist`: free lookup against OFAC SDN and Drain Watch
  - No payment, no key
  - The feed is cached for one hour

## Payment

`check_payee` and `check_signature` cost $0.005 per call. By default the agent pays over x402 from its own wallet, in USDC on Base or Solana. Any payment option above `maxPaymentUsdc` (default `0.01`, or the `VERIQL_MAX_PAYMENT_USDC` env var) is refused before anything is signed.

To use prepaid credits instead, pass `apiKey` or set `VERIQL_API_KEY`; the agent then never signs a payment. A free key is available at https://veriql.app/api/checkout?pack=free.

```typescript
import { veriqlActionProvider } from "@coinbase/agentkit";

const provider = veriqlActionProvider({ maxPaymentUsdc: 0.01 });
```

## Network Support

All networks. The checks are read-only API calls; x402 payment requires an EVM or Solana wallet.

## Notes

A clean answer means nothing adverse was found at the time of the check. It is not a guarantee. Any failure is returned as an error telling the agent to treat the input as unverified, never as a clean result.

API documentation: https://veriql.app/api
