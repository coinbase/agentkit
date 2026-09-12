# x402 Scraper Action Provider

Autonomous **HTTP 402 Web Scraper, Edge Llama-3 Digest, Security Audit & Twitter Intelligence Action Provider** for Coinbase AgentKit on **Base L2**.

Enables autonomous AI agents to scrape clean Markdown, generate executive digests, audit domain security, search the live web, and track real-time Twitter/X sentiment without API keys or subscriptions—settling autonomously via Base USDC micropayments.

## Actions

| Action Name | Description | Base Pricing (USDC) |
|---|---|---|
| `scrape_webpage` | Scrapes any public webpage and extracts clean, token-efficient Markdown for LLM prompts. | **$0.005** (5,000 units) |
| `digest_webpage` | Extracts executive summaries, key takeaways, and structured entities via Edge Llama-3. | **$0.025** (25,000 units) |
| `audit_webpage` | Audits website security, phishing risks, credibility signals, and smart contract signals. | **$0.080** (80,000 units) |
| `search_web` | Searches the live web across multiple engines and extracts synthesized clean Markdown. | **$0.050** (50,000 units) |
| `search_twitter` | Searches Twitter/X for keywords, cashtags (e.g. `$BASE`), sentiment, and recent tweets. | **$0.050** (50,000 units) |
| `get_twitter_profile` | Fetches a Twitter/X user profile bio, followers count, verification, and recent timeline. | **$0.030** (30,000 units) |

*All actions include 2 free trial requests before HTTP 402 micro-settlement is enforced.*

## Dual-Rail Settlement Protocol

- **Rail A (Primary)**: Gasless EIP-712 `TransferWithAuthorization` signature via PayAI facilitator (zero ETH gas required from agent wallet).
- **Rail B (Fallback)**: Direct on-chain ERC-20 Base USDC transfer receipt (`X-Payment-Receipt`).

## Usage

```typescript
import { AgentKit, EvmWalletProvider } from "@coinbase/agentkit";
import { x402ScraperActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider: new EvmWalletProvider({ privateKey: process.env.BASE_PRIVATE_KEY }),
  actionProviders: [
    x402ScraperActionProvider()
  ]
});
```
