# CDP Agentkit PydanticAI Extension Examples - Chatbot Python

This example demonstrates an agent setup as a terminal style chatbot using the PydanticAI integration with CDP Agentkit actions. The example showcases how to build conversational AI agents that can interact with the blockchain using PydanticAI's powerful type-safe framework.

## Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"
- "Show me my wallet balance"
- "Create a smart contract for a decentralized voting system"

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

- Ensure the following ENV Vars are set:
  - "CDP_API_KEY_ID"
  - "CDP_API_KEY_SECRET"
  - "CDP_WALLET_SECRET" # This is the wallet secret for the wallet you want to use for the chatbot
  - "OPENAI_API_KEY"
  - "NETWORK_ID" (Defaults to `base-sepolia`)

```bash
uv run chatbot.py
```

## About PydanticAI Integration

This example uses the PydanticAI framework, which provides:

- **Type Safety**: Strong typing throughout the agent pipeline
- **Validation**: Automatic validation of tool inputs and outputs
- **Modern Python**: Built with modern Python features like async/await
- **Flexible Architecture**: Easy to extend and customize

### Key Features

- **Async Support**: Full support for asynchronous operations
- **Tool Integration**: Seamless integration with CDP Agentkit actions
- **Type Validation**: Automatic validation of all inputs using Pydantic models
- **Error Handling**: Robust error handling and recovery

### Environment Notes

If you encounter any issues with async operations, the chatbot automatically handles nested event loops using `nest-asyncio`.

## Troubleshooting

If you see warnings about web3 versions, ensure you have web3 >= 7.10.0 installed for full feature compatibility:

```bash
uv add "web3>=7.10.0"
```

## Next Steps

After running the example, try:

1. Modifying the agent's behavior in `chatbot.py`
2. Adding custom tools using the PydanticAI Tool interface
3. Exploring different conversation flows and prompt engineering
4. Integrating with other PydanticAI features like dependencies and context
