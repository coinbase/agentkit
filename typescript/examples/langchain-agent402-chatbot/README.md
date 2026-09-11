# AgentKit + Agent402 Example - Buy market data over x402, deploy it to Base

This example is a terminal chatbot whose wallet can buy pay-per-call web data from [Agent402](https://agent402.tools) over x402 and then deploy what it bought to Base mainnet. One instruction takes it end to end: the agent finds the `crypto-price` tool, pays one cent of USDC for the live ETH price with its own wallet, and deploys an `Agent402PriceSnapshot` contract that stores the price, the source's timestamp, and the transaction hash of the payment that bought it. The purchase and the deployment reference each other on the same chain.

The Agent402 actions come from the [`agent402-agentkit`](https://www.npmjs.com/package/agent402-agentkit) action provider: `agent402_find` (free), `agent402_call` (pays over x402 for wallet-only tools, proof-of-work for free-tier tools) and `agent402_about` (free). The deploy action is defined in `chatbot.ts` with `customActionProvider`. Spend bounds ride with every paid call: no single call over $0.02 and no more than $0.25 in a rolling day.

## Ask the chatbot to buy data and ship it onchain

- "Buy the live ETH price from Agent402 and put it on chain."
- "What does Agent402 sell for SEC filings?"
- "Find a tool that renders a web page and tell me what it costs."

## Prerequisites

### Checking Node Version

Before using the example, ensure that you have the correct version of Node.js installed. The example requires Node.js 20 or higher. You can check your Node version by running:

```bash
node --version
```

If you don't have the correct version, you can install it using [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install node
```

### API Keys and a wallet

You'll need:

- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key) (or any OpenAI-compatible endpoint via `OPENAI_BASE_URL`)
- A private key for a wallet on Base mainnet holding a little USDC (the data costs about $0.01 per call; the x402 payment is gasless for the buyer) and a little ETH (the deployment measured about 490k gas, well under $0.01 at Base's usual gas price)

Rename `.env-local` to `.env` and set:

- "OPENAI_API_KEY"
- "PRIVATE_KEY"

## Running the example

From the root directory, run:

```bash
pnpm install
pnpm build
```

Now from the `typescript/examples/langchain-agent402-chatbot` directory, run:

```bash
pnpm start
```

To run a single instruction and exit:

```bash
PROMPT="Buy the live ETH price from Agent402 and put it on chain." pnpm start
```

## What happens

1. `agent402_find` returns the matching tools with slug, price and a ready example.
2. `agent402_call` buys `crypto-price`. Agent402 answers 402 with x402 accepts, the wallet provider signs a USDC authorization on Base, the facilitator settles it, and the settled `PAYMENT-RESPONSE` receipt is captured by the example's fetch wrapper.
3. `deploy_price_snapshot` deploys `contracts/Agent402PriceSnapshot.sol` (compiled with solc 0.8.28, committed as `contracts/artifact.json`) with the price, the source's timestamp, the source route and the payment transaction hash as constructor arguments, waits for the receipt, and reads the snapshot back at the receipt's block.
4. The agent reports the payment, deploy and contract links on basescan.

The contract has no owner, no receive or fallback, cannot hold funds, and stores only public data.

A scripted version of the same flow, proven from CI against production, lives in the Agent402 repository at [`examples/agentkit-data-to-deploy`](https://github.com/MikeyPetrillo/Agent402/tree/main/examples/agentkit-data-to-deploy).

## License

Apache-2.0
