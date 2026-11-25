# Read Lite Action Provider

This directory contains the **ReadLiteActionProvider** implementation, which adds a cheap Markdown page reader for agent loops.

It wraps the live [Read Lite](https://x402-web-reader.vercel.app/api/read-lite) endpoint — a single x402-gated POST ($0.005 USDC on Base, no API key) that fetches a web page and returns clean Markdown only: the page's `url`, `title`, `excerpt`, `markdown`, and `wordCount`. No search, no synthesis, no extra providers — the low-cost tier built for high-volume loops that read many pages (the full WebReader `/api/read` tier adds fallback providers and richer extraction at $0.02).

## Directory Structure

```
readlite/
├── readLiteActionProvider.ts       # Main provider (read_url_lite action)
├── readLiteActionProvider.test.ts  # Tests for the provider, truncation, and payment validation
├── schemas.ts                      # Read input + provider config schemas
├── constants.ts                    # Endpoint, price, payTo, and network constants
├── utils.ts                        # Markdown truncation + 402 payment-requirement validation
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `read_url_lite`: Pay $0.005 via x402 and read a web page as clean Markdown
  - Input: `url` (the page to fetch)
  - Output: `{ success, page }` where `page` is `{ url, title, excerpt, markdown, wordCount }`
  - Very long pages have their markdown truncated at 32,000 characters (`markdownTruncated: true`); `wordCount` still reports the full page size

## Spend safety

- The endpoint URL is a constant in `constants.ts`, never caller-supplied, so the action cannot be pointed at an arbitrary paid URL. (The page URL being *read* is the caller's input; the URL being *paid* is not.)
- Before signing, the provider makes an unpaid pre-flight request, decodes the 402, and refuses to pay unless the ask matches the known terms: Base mainnet (`eip155:8453`), at most $0.005, payTo `0xea8B7221507d1A0549e1ab96000a54401A7fDaC1`.
- The optional `maxPaymentUsdc` config can only lower the cap below $0.005.
- A failed read (HTTP 502 from the endpoint, page could not be extracted) is never charged — x402 does not settle on a non-200 response.

## Usage

```typescript
import { AgentKit, readLiteActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [readLiteActionProvider()],
});

// The read_url_lite action is now available to the agent. Instruct it:
// "When you need the contents of a specific page, call read_url_lite
//  with its URL and work from the returned Markdown."
```

## Network Support

Base mainnet only (`base-mainnet`) — that is the x402 payment rail; pages on any network can be read.

## Adding New Actions

1. Define the action schema in `schemas.ts`
2. Implement the action in `readLiteActionProvider.ts`
3. Add tests in `readLiteActionProvider.test.ts`
