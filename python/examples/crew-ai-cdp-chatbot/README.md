# CDP AgentKit CrewAI Extension Examples - Chatbot Python

This example demonstrates a terminal style chatbot using the CrewAI integration with CDP AgentKit actions.

## Ask the chatbot to engage in the Web3 ecosystem

- "What is the price of BTC?"
- "Request some test tokens from the faucet"
- "What are my CDP account details?"
- "Transfer a portion of your ETH to a random address"
- "Deploy an NFT that will go super viral"
- "Show me my wallet balance"

## Requirements

- Python 3.10+
- uv for package management and tooling
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

Check your local versions:

```bash
python --version
uv --version
```

## Installation

```bash
make install
```

## Run the Chatbot

Rename `.env.local` to `.env` and set:

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `CDP_WALLET_SECRET`
- `OPENAI_API_KEY`
- `NETWORK_ID` (defaults to `base-sepolia`)
- `RPC_URL` (optional)

Then run:

```bash
make run
```

## About CrewAI Integration

The CrewAI extension converts AgentKit actions into CrewAI `BaseTool` instances, preserving each action's name, description, and Pydantic argument schema.

## Next Steps

After running the example, try:

1. Modifying the agent role, goal, and backstory in `chatbot.py`
2. Adding or removing AgentKit action providers
3. Creating multi-agent crews that share the same AgentKit tool set
