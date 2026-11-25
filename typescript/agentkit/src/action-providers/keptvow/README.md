# Keptvow Action Provider

This directory contains the Keptvow action provider, which lets an agent check a seller's wallet or a bot on [Keptvow](https://keptvow.com) before paying it. Keptvow reads public payment history and answers `ok`, `careful` or `stop`, with the reason. It only reads: it never holds money, keys or wallets, and no wallet provider is needed.

## Directory Structure

```
keptvow/
├── constants.ts                  # API URL and timeout
├── index.ts                      # Main exports
├── keptvowActionProvider.test.ts # Tests for the provider
├── keptvowActionProvider.ts      # Main provider with Keptvow functionality
├── README.md                     # Documentation
├── schemas.ts                    # Keptvow action schemas
└── types.ts                      # Type definitions
```

## Actions

- `check_payment`: Check a wallet before paying it

  - Takes the wallet about to be paid (a 0x address or a Solana address) and, optionally, the amount in US dollars
  - Returns `ok`, `careful` or `stop`, the reason in plain words, and a link to the wallet's page
  - Also checks the wallet against the US sanctions list (OFAC)

- `check_bot`: Look up a bot's public record

  - Takes an ERC-8004 registry id such as `erc8004:8453:1234`, or a Keptvow agent id
  - Returns a trust level (`excellent`, `good`, `fair`, `caution` or `unknown`), a score and the reasons
  - `unknown` means Keptvow has no record yet, not that the bot is bad

- `report_delivery`: Tell Keptvow whether a payment delivered what was paid for

  - Takes the payment's transaction hash, whether the paid request delivered, and optionally the seller wallet
  - Keptvow checks the payment on Base within a minute: only a buyer who really paid that seller counts, once per payment
  - This is what lets honest sellers earn trust and flags sellers that take the money and deliver nothing

## Usage

```typescript
import { AgentKit, keptvowActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  actionProviders: [keptvowActionProvider()],
});
```

Checks need no API key. Platforms on a paid Keptvow plan can pass one:

```typescript
keptvowActionProvider({ apiKey: process.env.KEPTVOW_API_KEY });
```

## Network Support

The Keptvow provider is network-agnostic: it reads public records and works with every wallet provider and network.
