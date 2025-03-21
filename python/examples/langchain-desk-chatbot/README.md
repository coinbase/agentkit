# DESK Agentkit LangChain Extension Examples - Chatbot Python

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of DESK Agentkit actions.

## Ask the chatbot to engage in the Web3 ecosystem!
- "Check my DESK info"
- "Deposit USDC for 1000"
- "Market Long BTCUSD for 0.01"
- "Check current funding rate for ETHUSD"

## Requirements
- Python 3.10+
- Poetry for package management and tooling
  - [Poetry Installation Instructions](https://python-poetry.org/docs/#installation)
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
  - "OPENAI_API_KEY"
  - "PRIVATE_KEY"
  - "CHAIN_ID"
  - "SUB_ACCOUNT_ID"

```bash
poetry run python chatbot.py
``` 