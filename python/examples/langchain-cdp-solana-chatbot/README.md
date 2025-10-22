# CDP Agentkit LangChain Extension Examples - Solana Chatbot Python

This example demonstrates an agent setup as a terminal style chatbot with access to CDP Agentkit actions on the Solana blockchain.

## Ask the chatbot to engage in the Solana ecosystem!

- "What is your wallet address and balance?"
- "Request some SOL from the faucet"
- "Transfer some SOL to a random address"
- "Request some USDC from the faucet"

## Requirements

- Python 3.10+
- uv for package management and tooling
  - [uv Installation Instructions](https://github.com/astral-sh/uv?tab=readme-ov-file#installation)
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

### Checking Python Version

Before using the example, ensure that you have the correct version of Python installed. The example requires Python 3.10 or higher. You can check your Python version by running:

```bash
python --version
uv --version
```

## Installation

```bash
uv sync
```

## Run the Chatbot

### Set ENV Vars

Create a `.env` file in this directory with the following variables:

```bash
CDP_API_KEY_ID=[your CDP API Key ID from https://portal.cdp.coinbase.com/access/api]
CDP_API_KEY_SECRET=[your CDP API Secret Key from https://portal.cdp.coinbase.com/access/api]
CDP_WALLET_SECRET=[your CDP Wallet Secret Key from https://portal.cdp.coinbase.com/access/api]
OPENAI_API_KEY=[your OpenAI API Key from https://platform.openai.com/docs/quickstart#create-and-export-an-api-key]
NETWORK_ID=solana-devnet
```

### Available Networks

- `solana-mainnet` - Solana Mainnet
- `solana-devnet` - Solana Devnet (default)
- `solana-testnet` - Solana Testnet

Note: The faucet is only available on `solana-devnet`.

### Run the Example

```bash
uv run chatbot.py
```

## Features

- **Interactive Chat Mode**: Have a conversation with your Solana agent
- **Autonomous Mode**: Let the agent make its own decisions and take actions on Solana
- **Persistent Wallet**: The agent's wallet data is persisted across sessions using CDP
- **Faucet Support**: Request testnet SOL and USDC on devnet
