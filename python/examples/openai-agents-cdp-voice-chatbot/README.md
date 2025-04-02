# OpenAI Agents CDP Voice Chatbot

This example demonstrates an agent setup as a voice chatbot that runs in the terminal using the OpenAI Agents SDK integration with CDP Agentkit actions.

The code is based on the [OpenAI Agents SDK Streamed Voice Demo](https://github.com/openai/openai-agents-python/tree/main/examples/voice/streamed).

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"

## Requirements

- Python 3.10+
- Poetry for package management and tooling
  - [Poetry Installation Instructions](https://python-poetry.org/docs/#installation)
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

### Checking Python Version

Before using the example, ensure that you have the correct version of Python installed. The example requires Python 3.10 or higher. You can check your Python version by running:

```bash
python --version
poetry --version
```

## Installation

```bash
poetry install
```

## Run the Chatbot

### Set ENV Vars

- Ensure the following ENV Vars are set:
  - "CDP_API_KEY_NAME"
  - "CDP_API_KEY_PRIVATE_KEY"
  - "OPENAI_API_KEY"
  - "NETWORK_ID" (Defaults to `base-sepolia`)

```bash
poetry run python main.py
```

Note: If you are seeing the log `OPENAI_API_KEY is not set, skipping trace export`, fix it by exporting the OPENAI_API_KEY in your terminal.

```sh
export OPENAI_API_KEY=<your-openai-api-key>
```
