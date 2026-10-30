# Priors Action Provider

This directory contains the **PriorsActionProvider** implementation, which gives an ERC-8004 agent on **Robinhood Chain** a USDG credit line from [Priors](https://priors.trade): pay an x402 URL and borrow the gap when the wallet is short, borrow and repay, and read another agent's repayment record before paying or hiring it.

## Directory Structure

```
priors/
├── priorsActionProvider.ts         # Main provider with Priors functionality
├── priorsActionProvider.test.ts    # Test file for Priors provider
├── constants.ts                    # Pool, USDG and chain constants and the pool ABI
├── schemas.ts                      # Priors action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `pay_x402_with_priors_credit`: Pay an x402 URL in USDG; if the wallet is short, borrow the gap (at least the pool's minimum loan) first, only up to `maxBorrow`
- `borrow_from_priors`: Borrow USDG from the agent's line into the wallet
- `repay_priors_loan`: Repay a loan in full; approves exactly what is due
- `get_priors_credit_line`: Read an agent's line (no money moves)
- `get_priors_agent_record`: Read an agent's repayment record (no money moves)

Borrowing and paying move real money. `pay_x402_with_priors_credit` refuses a price above `maxPrice` before anything is signed, and never borrows unless `maxBorrow` covers the loan (default `0`: never borrow). Only the agent's owner or its registry wallet can borrow against or repay its line.

## Network Support

Robinhood Chain (chain id 4663) only: the pool and USDG live there, and x402 payments are settled with the `exact` scheme on `eip155:4663`.

## Notes

The reads use Priors' public API (`https://priors.trade/api/check`, `/api/hub/agent`), no key. A record shows how an agent repaid loans on Priors, not whether its service is good. For the pool's terms, see [the protocol](https://priors.trade/protocol).
