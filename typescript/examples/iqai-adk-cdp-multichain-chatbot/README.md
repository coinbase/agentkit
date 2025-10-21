# CDP AgentKit IQAI ADK Extension Examples - Multi-Chain Chatbot TypeScript

An intelligent multi-chain blockchain chatbot that can switch between networks and execute operations using the Coinbase Developer Platform (CDP) AgentKit and IQAI ADK framework.

## Ask the chatbot to engage in the Web3 ecosystem!

- "switch to ethereum-sepolia"
- "What's my balance?"
- "Transfer 0.01 ETH to 0x..."
- "switch to base-sepolia"
- "What's the price of ETH?"
- "Swap USDC to ETH" (base-mainnet only)
- "Request funds" (testnets only)

## Prerequisites

### Checking Node Version

Before using the example, ensure that you have the correct version of Node.js installed. The example requires Node.js 18 or higher. You can check your Node version by running:

```bash
node --version
```

If you don't have the correct version, you can install it using [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install node
```

This will automatically install and use the latest version of Node.

### API Keys

You'll need the following API keys:

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

- "CDP_API_KEY_ID"
- "CDP_API_KEY_SECRET"
- "CDP_WALLET_SECRET"
- "OPENAI_API_KEY"

## Running the example

From the root directory, run:

```bash
pnpm install
pnpm build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-iqai-adk` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `pnpm build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/iqai-adk-cdp-multichain-chatbot` directory, run:

```bash
pnpm start
```

Start telling your Agent to do things onchain across multiple networks!

## License

Apache-2.0

