# CDP Agentkit Autogen Extension Examples - Chatbot Python

This example demonstrates an agent setup as a terminal style chatbot using Microsoft Autogen integration with CDP Agentkit actions.

## Ask the chatbot to engage in the Web3 ecosystem!

- "What is the price of BTC?"
- "Request some test tokens from the faucet"
- "What are my CDP account details?"
- "Transfer a portion of your ETH to a random address"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"

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
make install
```

## Run the Chatbot

### Env

Rename .env.local to .env and ensure the following var are set:

- "CDP_API_KEY_ID"
- "CDP_API_KEY_SECRET"
- "CDP_WALLET_SECRET" # This is the wallet secret for the wallet you want to use for the chatbot
- "OPENAI_API_KEY"

```bash
make run
```
