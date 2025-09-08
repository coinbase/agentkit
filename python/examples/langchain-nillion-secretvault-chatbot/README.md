# CDP Agentkit LangChain Extension with Nillion SecretVault Examples - Chatbot Python

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of CDP Agentkit actions.

## Ask the chatbot to engage in the Web3 ecosystem!
- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"
- "Create a secure schema to track my ERC-20 purchases"
- "Look up my schema for tracking my medications and add some test data to it"

## Requirements
- Python 3.10+
- uv for package management and tooling
  - [uv Installation Instructions](https://github.com/astral-sh/uv?tab=readme-ov-file#installation)
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Nillion SecretVault API Key](https://secret-vault-registration.replit.app)

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
- Ensure the following ENV Vars are set:
  - "CDP_API_KEY_ID"
  - "CDP_API_KEY_SECRET"
  - "OPENAI_API_KEY"
  - "NETWORK_ID" (Defaults to `base-sepolia`)
  - "NILLION_ORG_ID"
  - "NILLION_SECRET_KEY"

```bash
uv run chatbot.py
``` 
