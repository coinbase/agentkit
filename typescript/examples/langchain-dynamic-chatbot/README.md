# Dynamic AgentKit LangChain Chatbot Example

This example demonstrates how to use AgentKit with Dynamic wallet provider and LangChain to create a chatbot that can interact with the Solana blockchain.

## Prerequisites

- Node.js 18+
- [Dynamic Account](https://www.dynamic.xyz/) and API credentials
- [OpenAI API Key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)

## Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy the example environment file and fill in your credentials:
```bash
cp .env-local .env
```

3. Update the `.env` file with your credentials:
```
OPENAI_API_KEY=your_openai_api_key

# Dynamic Configuration - get these from your Dynamic dashboard
DYNAMIC_AUTH_TOKEN=your_dynamic_auth_token
DYNAMIC_ENVIRONMENT_ID=your_dynamic_environment_id
DYNAMIC_BASE_API_URL=https://app.dynamicauth.com
DYNAMIC_BASE_MPC_RELAY_API_URL=relay.dynamicauth.com

# Optional Network ID. If you'd like to use a Dynamic Solana wallet, set to "solana-devnet". Otherwise, defaults to "mainnet-beta"
NETWORK_ID=solana-devnet

# Optional CDP API Key Name. If you'd like to use the CDP API, for example to faucet funds, set this to the name of the CDP API key
CDP_API_KEY_NAME=your_cdp_api_key_name

# Optional CDP API Key Private Key. If you'd like to use the CDP API, for example to faucet funds, set this to the private key of the CDP API key
CDP_API_KEY_PRIVATE_KEY=your_cdp_api_key_private_key
```

## Running the Example

Start the chatbot:
```bash
npm start
```

The chatbot will start in either chat mode or autonomous mode:

- **Chat Mode**: Interact with the agent through a command-line interface
- **Autonomous Mode**: The agent will automatically perform actions on the blockchain at regular intervals

## Features

- Uses Dynamic's wallet API for Solana blockchain interactions
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
