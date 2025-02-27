# Viem Wallet AgentKit LangChain Extension Example - Chatbot

This example demonstrates an agent setup as a terminal chatbot using a Viem wallet to interact with Base mainnet, including Aave protocol interactions.

## Example Actions

- "Check my wallet balance"
- "Supply ETH or USDC to Aave on Base mainnet"
- "Check token prices using Pyth"
- "Withdraw assets from Aave"

## Prerequisites

### Node Version Requirements

Ensure you have Node.js 18 or higher installed:

```bash
node --version
```

If needed, install using [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install node
```

### Environment Setup

Rename `.env-local` to `.env` and configure these variables:

```env
OPENAI_API_KEY=     # Your OpenAI API key
PRIVATE_KEY=        # Your wallet's private key
NETWORK_ID=         # base-mainnet
RPC_URL=           # Base mainnet RPC URL (optional)
```

## Running the Example

From the root directory:

```bash
npm install
npm run build
```

Then from the `typescript/examples/langchain-viem-chatbot` directory:

```bash
npm start
```

Select chat mode (option 1) to start interacting with the agent.

## Features

- Direct wallet interactions using Viem
- Aave protocol integration on Base mainnet
- Price feeds via Pyth
- ERC20 token management
- ETH/WETH operations

## License

Apache-2.0
