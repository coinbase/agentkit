# WaaP AgentKit LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal-style chatbot with a [WaaP (Wallet as a Protocol)](https://waap.xyz) wallet.

WaaP uses two-party computation (2PC) to split private keys between the client and server, so keys are never fully exposed in any single location. The AgentKit integration wraps the `waap-cli` binary behind the standard wallet provider interface.

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "What kind of wallet do you have?"
- "What is your wallet address?"

## Requirements

- [Node.js 18+](https://nodejs.org/en/download/current)
- [waap-cli](https://www.npmjs.com/package/@human.tech/waap-cli) installed globally or available on `$PATH`
- A WaaP account (sign up via `waap-cli signup --email you@example.com`)

### Install waap-cli

```bash
npm install -g @human.tech/waap-cli
```

### Checking Node Version

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

Create a `.env` file (or copy `.env-local`) with the following variables:

```bash
# Required
OPENAI_API_KEY=            # OpenAI API key for the LLM
WAAP_EMAIL=                # WaaP account email
WAAP_PASSWORD=             # WaaP account password

# Optional
WAAP_CLI_PATH=             # Path to waap-cli binary (default: "waap-cli")
WAAP_CHAIN_ID=             # EVM chain ID (default: "84532" for Base Sepolia)
WAAP_RPC_URL=              # Custom RPC URL for the chain
```

#### Multi-Agent Isolation

WaaP supports creating isolated wallets for each agent using `+` email notation:

```bash
WAAP_EMAIL=owner+agent007@example.com
```

Each `+` alias gets its own wallet, allowing multiple agents to operate independently under a single account.

### Start the chatbot

```bash
npm start
```

## License

[Apache-2.0](../../../LICENSE.md)
