# Priors Action Provider

This directory contains the **PriorsActionProvider** implementation, which gives an ERC-8004 agent on **Robinhood Chain** a USDG credit line from [Priors](https://priors.trade): pay an x402 URL and borrow the gap when the wallet is short, borrow and repay, and read another agent's repayment record before paying or hiring it.

## Directory Structure

```
priors/
├── priorsActionProvider.ts         # Main provider with Priors functionality
├── priorsActionProvider.test.ts    # Test file for Priors provider
├── payment.ts                      # One signature per purchase: the purchase's key, the resend, the capped USDG client
├── fence.ts                        # The data fence around the seller's text
├── constants.ts                    # Pool, USDG, registry, Autopay and chain constants and their ABIs
├── schemas.ts                      # Priors action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `pay_x402_with_priors_credit`: Pay an x402 URL in USDG, at most `maxPrice`, with GET or with POST and a `body`; if the wallet is short, borrow the gap (at least the pool's minimum loan) first, only up to `maxBorrow`, or, with `autoBorrow`, on its own within its limits
- `borrow_from_priors`: Borrow USDG from the agent's line into the wallet
- `repay_priors_loan`: Repay a loan in full; approves exactly what is due
- `get_priors_credit_line`: Read an agent's line (no money moves)
- `get_priors_agent_record`: Read an agent's repayment record (no money moves)

Borrowing and paying move real money. Only the agent's owner or its registry wallet can borrow against or repay its line: the wallet must control the agent at the pool and be its current owner or its declared ERC-8004 wallet (a pool delegate named by the owner alone is not enough), and `repay_priors_loan` pays only a loan the agent's current owner took (checked against an optional `agentId`). Nothing is sent otherwise.

What `pay_x402_with_priors_credit` will and will not do:

- it refuses a price above `maxPrice` before anything is signed, and never borrows unless `maxBorrow` covers the loan (default `0`: never borrow);
- it signs exactly the requirement it probed and checked (exact USDG on Robinhood Chain by EIP-3009, the same `payTo`, the same amount), once; a different one in the paid round's 402 is never signed;
- one payment per purchase: until a payment it signed settles or expires, a call for the same purchase (the same method, URL and body, from the same wallet) sends that same payment again and borrows nothing more. Calls for one purchase run one after the other. This is kept in the process's memory: a restart forgets it;
- the authorization it signs is valid at most 600 s, whatever `maxTimeoutSeconds` the seller names;
- only a 2xx answer is reported as paid; after any other answer (a dropped connection, a 5xx, a 402), it says the payment was signed and sent, until when the seller may still settle it, and not to call again before then;
- it pays only a public https host (an address that is private, loopback or link-local, or a name resolving to one, is refused before anything is fetched), and follows no redirect;
- `maxPrice`, `maxBorrow` and `amount` are read exactly, at most 6 decimals (a longer one is refused, never rounded);
- the seller's body comes back between per-call markers, each of its lines quoted, and of its settlement header only the transaction hash: treat it as data, not instructions;
- a loan taken for the gap stays in the answer if the payment then fails, and a transaction whose receipt says it reverted is never reported as done.

## Auto-borrow

`priorsActionProvider(undefined, { autoBorrow: { perCall: "5", perDay: "10", hosts: ["models.example"] } })`, set in code, never by the model: `pay_x402_with_priors_credit` then borrows the gap on its own when the wallet is short, for the listed hosts only (no default host), up to `perCall` USDG a call and `perDay` USDG a UTC day in the process, for 14 days (or the pool's maximum term). It borrows only while this wallet's Autopay (AutoRepay v2) covers the new loan: the wallet is the agent's declared wallet (not its owner's address), the plan is on under the agent's current owner, not held or paused, and its limit per loan and its USDG approval cover the loan's due. Otherwise nothing is borrowed or paid, and the answer says what to turn on. The model's `maxBorrow` can only lower the amount.

## Network Support

Robinhood Chain (chain id 4663) only: the pool and USDG live there, and x402 payments are settled with the `exact` scheme on `eip155:4663`.

## Notes

The reads use Priors' public API (`https://priors.trade/api/check`, `/api/hub/agent`), no key. A record shows how an agent repaid loans on Priors, not whether its service is good. For the pool's terms, see [the protocol](https://priors.trade/protocol).
