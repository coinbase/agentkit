# Privy AgentKit LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a self-aware terminal style chatbot with a [Privy server wallet](https://docs.privy.io/guide/server-wallets/).

Privy wallets are embedded wallets - learn more at https://docs.privy.io/guide/server-wallets/. The Agentkit integration assumes you have a Privy server wallet ID which you want to use for your agent - creation and management of Privy wallets can be done via the Privy dashboard or API.

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
  - PRIVY_WALLET_ID=
  - PRIVY_WALLET_AUTHORIZATION_KEY=[optional, only if you are using authorization keys for your server wallets]

```bash
npm start
```

## License

Apache-2.0
