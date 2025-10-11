# CDP AgentKit LangChain XMTP Extension Examples - Chatbot Typescript

This example demonstrates an agent setup on XMTP Network with access to the full set of CDP AgentKit actions.

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Swap 1 USDC to ETH" (base-mainnet only)
- "List x402 services"

## Special Commands

### `/fund` Command - Send ETH to the agent

Send ETH from your wallet to the agent's wallet using the `/fund` command.
Review transaction details, click submit and then approve transaction in your connected browser wallet.

**Usage:**
- `/fund <amountInEth>` - Send ETH to the agent

**Example:**
- `/fund 0.01` - Send 0.01 ETH to the agent


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
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Generate Wallet Secret](https://portal.cdp.coinbase.com/products/wallet-api)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `CDP_API_KEY_ID` - Your CDP API key ID
- `CDP_API_KEY_SECRET` - Your CDP API key secret
- `CDP_WALLET_SECRET` - Your CDP wallet secret (for deterministic wallet generation)
- `XMTP_WALLET_KEY` - Private key for XMTP agent (use `pnpm run gen:keys` to generate)
- `XMTP_DB_ENCRYPTION_KEY` - Database encryption key for XMTP (use `pnpm run gen:keys` to generate)

**Optional:**
- `NETWORK_ID` - Network to use (defaults to "base-sepolia")
- `XMTP_ENV` - XMTP environment: "local", "dev", or "production" (defaults to "dev")
- `RPC_URL` - Custom RPC URL for blockchain interactions

You can generate XMTP keys by running:
```bash
pnpm run gen:keys
```

## Running the example

From the root directory, run:

```bash
pnpm install
pnpm build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-langchain` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `pnpm build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/langchain-xmtp-chatbot` directory, run:

```bash
pnpm start
```

The agent will start and listen for messages on the XMTP network. You can interact with it by:
1. Visiting the URL displayed in the console (e.g., `http://xmtp.chat/dm/0x...?env=dev`)
2. Sending messages to the agent's address via any XMTP client

## License

Apache-2.0
