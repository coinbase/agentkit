# Privy AgentKit LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a self-aware terminal style chatbot with a [Privy server wallet](https://docs.privy.io/guide/server-wallets/) or [Privy delegated embedded wallet](https://docs.privy.io/wallets/overview/index#embedded-wallets).

Privy's server wallets enable you to securely provision and manage cross-chain wallets via a flexible API - learn more at https://docs.privy.io/guide/server-wallets/. The Agentkit integration assumes you have a Privy server wallet ID which you want to use for your agent - creation and management of Privy wallets can be done via the Privy dashboard or API.

Privy's embedded wallets, when delegated, also enable you to securely provision and manage cross-chain wallets via a flexible API - learn more at https://docs.privy.io/wallets/overview/index#embedded-wallets and https://docs.privy.io/wallets/using-wallets/server-sessions/usage#delegating-access. The Agentkit integration assumes you have a Privy delegated embedded wallet ID which you want to use for your agent - creation and management of Privy wallets can be done via the Privy dashboard or API.

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "What kind of wallet do you have?"

## Requirements

- Node.js 18+
- [Privy](https://dashboard.privy.io/apps) (see ENV Vars below for details)

### Checking Node Version

Before using the example, ensure that you have the correct version of Node.js installed. The example requires Node.js 18 or higher. You can check your Node version by running:

```bash
node --version
npm --version
```

## Installation

```bash
npm install
```

## Run the Chatbot

### Set ENV Vars

- Ensure the following ENV Vars from your Privy dashboard are set in `.env`:
  - PRIVY_APP_ID=
  - PRIVY_APP_SECRET=
  - PRIVY_WALLET_ID=[For server wallets, optional, otherwise a new wallet will be created. For delegated embedded wallets, required and refers to the delegated wallet id]
  - PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY=[For server wallets, optional, only if you are using authorization keys. For delegated embedded wallets, required]
  - PRIVY_WALLET_AUTHORIZATION_KEY_ID=[For server wallets, optional, only if walletId is not provided in order to create a new wallet, this can be found in your Privy Dashboard. For delegated embedded wallets, required]
  - NETWORK_ID=[optional. If you'd like to use a Privy Solana wallet, set to "solana-devnet". Otherwise, defaults to "base-sepolia" and will use a Privy EVM wallet]
  - CDP_API_KEY_ID=[optional. If you'd like to use the CDP API, for example to faucet funds, set this to the name of the CDP API key]
  - CDP_API_KEY_SECRET=[optional. If you'd like to use the CDP API, for example to faucet funds, set this to the private key of the CDP API key]

You can manage authorization keys from your [Privy dashboard](https://dashboard.privy.io/account) or programmatically [using the API](https://docs.privy.io/guide/server-wallets/authorization/signatures).

```bash
npm start
```

## License

Apache-2.0
