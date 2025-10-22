# CDP AgentKit Vercel AI SDK Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of CDP AgentKit actions.

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"

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
- "OPENAI_API_KEY"
- "PRIVATE_KEY" (optional, will generate a new private key if not provided)

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-vercel-ai-sdk` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/vercel-ai-sdk-smart-wallet-chatbot` directory, run:

```bash
npm start
```

Select "1. chat mode" and start telling your Agent to do things onchain!

## License

Apache-2.0
