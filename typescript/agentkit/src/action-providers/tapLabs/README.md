# TAP Labs Action Provider

This directory contains the TAP Labs action provider. It gives an agent two safety checks to run before it buys,
swaps or signs, using agents from [TAP Labs](https://labs.theatlasproject.dev):

- `check_token_safety` asks TAP Labs' **Safety Check** about a token on Base or Solana, or a contract on Base.
- `check_transaction` asks TAP Labs' **Wallet Firewall** what a wallet request would do, and whether it matches
  what the user asked for.

Each check is paid per call in USDC on Base with [x402](https://www.x402.org), from the agent's own wallet. There
is no API key and no sign-up.

## Getting Started

The agent's wallet must be on Base mainnet and hold a little USDC on Base. Current prices: $0.01 per token check,
$0.02 per transaction check. TAP Labs sets its prices; the limits below cap what this provider will pay.

```typescript
import { AgentKit, tapLabsActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [tapLabsActionProvider()],
});
```

### Configuration

```typescript
tapLabsActionProvider({
  maxPaymentUsdc: 0.03, // the most one check may cost
  maxTotalUsdc: 1, // the most this provider instance may sign for in total
});
```

| Option           | Default                            | What it does                                                                                            |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `maxPaymentUsdc` | `0.03`                             | The most one check may cost, in USDC (at most 1). A check that asks for more is refused before signing. |
| `maxTotalUsdc`   | `1`                                | The most this provider instance may sign for in total, in USDC (at most 100). Then checks are refused.   |
| `baseUrl`        | `https://labs.theatlasproject.dev` | Where TAP Labs answers. Must be https (http only on localhost, for local testing).                      |
| `payTo`          | TAP's wallet                       | The only address a payment may go to.                                                                   |

## How a check is paid

1. The action sends the request without payment. TAP Labs answers `402 Payment Required` with its price.
2. The action checks the price before signing anything. It pays only an `exact` USDC payment on Base mainnet
   (`eip155:8453`), to TAP's wallet, at or under `maxPaymentUsdc`, valid for at most 10 minutes, using USDC's own
   EIP-712 domain. Anything else is refused and nothing is paid. The `maxTotalUsdc` budget is reserved before
   signing.
3. It signs one USDC transfer authorization (EIP-3009). The x402 library is given only the wallet's address and
   typed-data signing: it cannot send transactions, approve tokens or read the wallet's contracts. The 402's
   `extensions` are not passed on. Then it sends the same request again with the payment.
4. TAP Labs runs the check and settles the payment only together with a successful answer. `payment` in the
   result says whether the check was charged; when that cannot be known (an error after the payment was signed),
   the result says so and asks the agent to check the wallet's USDC transfers.

Each action makes at most one payment and never retries a paid request. Redirects are refused, so a payment can
only go to the configured host.

## Actions

### `check_token_safety`

Input: `address` (a `0x` address on Base, or a Solana mint address) and, optionally, `chain` (`base` or `solana`).

It reads public chain data and public lists: who can mint, freeze, blacklist, pause, tax or upgrade the token,
liquidity and the age of its first pool, how much the biggest holders own, whether the code is verified (Base),
and matches on public scam lists (Base) and the OFAC sanctions list. It does not simulate a sale, so the best
verdict most tokens can get is `warn`.

### `check_transaction`

Input: `request` (the wallet request exactly as received: a transaction, typed data such as a permit, a sign-in
message, an EIP-7702 authorization, a JSON-RPC call, or a Solana transaction), `intent` (what the user asked, in
their own words) and, optionally, `chain`, `site` and `addressBook`. The agent's own address is sent as the signer.

It reads the request and compares it with the intent. It can flag a wrong amount or recipient, an address that
imitates one in the `addressBook`, an approval to the wrong spender, a sign-in for another `site` and hidden extra
calls, and it checks public scam and phishing lists and the OFAC sanctions list. It never signs, sends or
simulates anything; a step it cannot read is reported as unreadable, never as fine.

## What comes back

Both actions return JSON with:

- `verdict`: `block`, `warn`, `ok` or `unknown`, and `whatToDo` (what the agent should do with it);
- `summary`, `findings` (severity, title, detail, category, source) and `notChecked`;
- for transactions, `steps` (what the request does) and `youAsked` (how the intent was read);
- `payment`: whether the check was charged (`true`, `false` or `"unknown"`), how much and the settlement
  transaction.

The text is capped in size and cleaned of control and invisible characters. Findings can quote text written by
others, such as a token's name; the result marks it as data, not instructions.

## What is sent

- `check_token_safety` sends the token address and, if given, the chain.
- `check_transaction` sends the request, the user's intent, this wallet's address, the chain and, if given, the
  site and the address book.

They go to TAP Labs at `labs.theatlasproject.dev`, run by TAP (The Atlas Project AI, LLC), which uses them to
answer the check. Only send what you are willing to share with it. The payment itself is a public USDC transfer
on Base. Terms: [theatlasproject.dev/docs/terms](https://theatlasproject.dev/docs/terms).

## It is advisory

The checks inform the agent; they do not control it. Nothing makes an agent call them or follow a `block`
verdict: the agent's own instructions decide that. `ok` is not a guarantee, and `unknown` must never be treated as
safe.

## Directory Structure

```
tapLabs/
├── constants.ts                     # Endpoints, TAP's payee address and limits
├── index.ts                         # Main exports
├── README.md                        # This file
├── schemas.ts                       # Action schemas and configuration
├── tapLabsActionProvider.test.ts    # Tests
└── tapLabsActionProvider.ts         # The provider
```

## Network Support

Base mainnet only: checks are paid in USDC on Base. `check_token_safety` can check tokens on Base and on Solana.
