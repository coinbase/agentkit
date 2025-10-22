# Solana AgentKit LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of Solana AgentKit actions.

## Ask the chatbot to engage in the Web3 ecosystem!

- "What is your address and balance?"
- "Transfer a portion of your SOL to a random address"

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
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

- "OPENAI_API_KEY" **(required)**
- "SOLANA_PRIVATE_KEY" *(optional)*
- "SOLANA_RPC_URL" *(optional)*
- "NETWORK_ID" *(optional)*
- CDP_API_KEY_ID=[optional. If you'd like to use the CDP API, for example to faucet funds, set this to the id of the CDP API key]
- CDP_API_KEY_SECRET=[optional. If you'd like to use the CDP API, for example to faucet funds, set this to the private key of the CDP API key]


#### Network Selection

The supported networks are `solana-mainnet`, `solana-devnet`, and `solana-testnet`.

Network selection follows this priority:
1. **Explicit RPC URL** – If `SOLANA_RPC_URL` is set in your `.env`, this RPC URL is used, and the network is inferred from it.
2. **Network ID** – If `SOLANA_RPC_URL` is not set but `NETWORK_ID` is, the network is determined by `NETWORK_ID`, and a default RPC URL is assigned accordingly.
3. **Fallback** – If neither variable is set, the default network is `solana-devnet` with a default RPC URL.

#### Keypair Selection

The keypair is determined by the `SOLANA_PRIVATE_KEY` in your `.env``.

If no keypair is provided, a new one will be generated, and the private key will be displayed in the console. To reuse it in future runs, save the displayed key to `SOLANA_PRIVATE_KEY` in your `.env`.

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-langchain` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/langchain-solana-chatbot` directory, run:

```bash
npm start
```

Select "1. chat mode" and start telling your Agent to do things onchain!

## License

Apache-2.0
