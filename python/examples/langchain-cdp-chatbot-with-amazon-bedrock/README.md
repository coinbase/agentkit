# CDP Agentkit LangChain Extension Powered by Amazon Bedrock Models

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of CDP Agentkit actions, using [Amazon Bedrock](https://aws.amazon.com/bedrock/) models.

## Ask the chatbot to engage in the Web3 ecosystem!
- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"

## Requirements
- Python 3.10+
- uv for package management and tooling
  - [uv Installation Instructions](https://github.com/astral-sh/uv?tab=readme-ov-file#installation)
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [AWS API Keys](https://aws.amazon.com/bedrock/)

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
  - "AWS_ACCESS_KEY_ID"
  - "AWS_SECRET_ACCESS_KEY"
  - "NETWORK_ID" (Defaults to `base-sepolia`)

```bash
uv run chatbot.py
``` 
