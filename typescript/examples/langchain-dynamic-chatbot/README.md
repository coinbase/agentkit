# Dynamic AgentKit LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of CDP AgentKit actions using Dynamic wallet provider.

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"

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

This will automatically install and use the latest version of Node.

### API Keys

You'll need the following API keys:
- [Dynamic Account](https://www.dynamic.xyz/) and API credentials
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

- "OPENAI_API_KEY"
- "DYNAMIC_AUTH_TOKEN"
- "DYNAMIC_ENVIRONMENT_ID"

## Running the example

From the root directory, run:

```bash
pnpm install
pnpm build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-langchain` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `pnpm build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/langchain-dynamic-chatbot` directory, run:

```bash
pnpm start
```

Select "1. chat mode" and start telling your Agent to do things onchain!

## Features

- Uses Dynamic's wallet API for EVM and Solana blockchain interactions
- Integrates with LangChain for natural language processing
- Supports both interactive chat and autonomous modes
- Can perform various blockchain actions like:
  - Checking wallet balance
  - Sending transactions
  - Interacting with smart contracts
  - And more!

## Learn More

- [AgentKit Documentation](https://docs.cdp.coinbase.com)
- [Dynamic Documentation](https://docs.dynamic.xyz)
- [LangChain Documentation](https://js.langchain.com/docs)

## License

Apache-2.0
