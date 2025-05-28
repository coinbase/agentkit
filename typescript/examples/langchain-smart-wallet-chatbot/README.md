# AgentKit CDP Smart Wallet Example

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of AgentKit actions. A CDP Smart Wallet will be created and owned by the signer passed into the example.

## Ask the chatbot to engage in the Web3 ecosystem!
- "Transfer a portion of your ETH to a random address"
- "Use the faucet"
- "What is the price of BTC?"

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

### Set ENV Vars

You'll need the following API keys:
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

#### Required:
  - `CDP_API_KEY_ID=`
  - `CDP_API_KEY_SECRET=`
  - `OPENAI_API_KEY=`

#### Optional:
  - `PRIVATE_KEY=` *(if not provided, a new key will be generated)*
  - `NETWORK_ID=` *(defaults to base-sepolia if not set)*

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-langchain` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/langchain-smart-wallet-chatbot` directory, run:

```bash
npm start
```

Select "1. chat mode" and start interacting with your Smart Wallet agent!

## License

Apache-2.0
