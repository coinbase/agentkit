# Privy Embedded Wallet AgentKit Example

This example demonstrates how to use a Privy embedded wallet with delegation in AgentKit to create an AI agent that can perform onchain actions on behalf of users.

## Features

- Uses Privy's embedded wallet with delegation for onchain actions
- Supports all standard wallet operations (transactions, message signing, transfers)
- Interactive chatbot interface powered by LangChain + GPT-4o Mini
- Persists wallet data across sessions

## Ask the agent to perform onchain actions!

- "What is your wallet address and current balance?"
- "Transfer 0.001 ETH to 0x8dB6A7836ed47CeD0Ee15C8727EdABA5dd7baEA8"
- "What are the current gas prices on this network?"
- "Get the price of ETH from Pyth"
- "Check the balance of USDC in my wallet"

## Prerequisites

### Node.js

Before using the example, ensure that you have Node.js 18 or higher installed. You can check your Node version by running:

```bash
node --version
```

If you need to update, you can install the latest version using [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install node
```

### Privy Wallet Delegation Setup

This example requires:

1. A Privy account with embedded wallets enabled
2. An embedded wallet that has been delegated to your server
3. The delegated wallet ID
4. Authorization keys for your Privy account

To set up delegation:
1. Implement Privy embedded wallets in your application
2. Add server-delegated action functionality
3. Have users delegate transaction signing capabilities to your server
4. Record the delegated wallet ID

For more information, see [Privy's documentation on server delegation](https://docs.privy.io/guide/server-wallets/delegated-actions).

### API Keys

You'll need the following:
- [Privy App ID and App Secret](https://dashboard.privy.io)
- [Privy Authorization Private Key](https://dashboard.privy.io/account) (if your account uses authorization keys)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [CDP API Key](https://portal.cdp.coinbase.com/access/api) (optional, for CDP specific actions)

## Configuration

Create a `.env` file with the following variables:

```
OPENAI_API_KEY=your_openai_api_key
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY=your_privy_authorization_key
PRIVY_DELEGATED_WALLET_ID=your_delegated_wallet_id
NETWORK_ID=base-mainnet  # or another network of your choice

# Optional, for CDP actions
CDP_API_KEY_NAME=your_cdp_key_name
CDP_API_KEY_PRIVATE_KEY=your_cdp_private_key
```

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally.

Now run the example:

```bash
npm start
```

The agent will initialize with your delegated wallet and you can start chatting with it to perform onchain actions!

## How it works

1. The example connects to your Privy account using the provided credentials
2. It initializes the `PrivyWalletProvider` with the `walletType: "embedded"` option to use your delegated wallet
3. AgentKit tools are loaded and made available to the LangChain agent
4. The agent can now perform onchain actions through the delegated wallet using natural language commands

## License

Apache-2.0