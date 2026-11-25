# AgentKit CrewAI Extension

CrewAI extension for AgentKit. Enables CrewAI agents to use AgentKit onchain actions as CrewAI tools.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

### Installation

```bash
pip install coinbase-agentkit coinbase-agentkit-crewai
```

### Environment Setup

Set the following environment variables:

```bash
export OPENAI_API_KEY=<your-openai-api-key>
export CDP_API_KEY_ID=<your-cdp-api-key-id>
export CDP_API_KEY_SECRET=<your-cdp-api-key-secret>
export CDP_WALLET_SECRET=<your-cdp-wallet-secret>
```

## Usage

```python
from coinbase_agentkit import AgentKit
from coinbase_agentkit_crewai import get_crewai_tools
from crewai import Agent

agentkit = AgentKit()
tools = get_crewai_tools(agentkit)

agent = Agent(
    role="CDP Agent",
    goal="Use AgentKit tools to interact onchain.",
    backstory="You are a helpful agent with access to a crypto wallet.",
    tools=tools,
)
```

For AgentKit configuration options, see the [Coinbase AgentKit README](https://github.com/coinbase/agentkit/blob/main/python/coinbase-agentkit/README.md).

For CrewAI configuration options, see the [CrewAI Documentation](https://docs.crewai.com/).

For a full example, see the [CrewAI chatbot example](https://github.com/coinbase/agentkit/blob/main/python/examples/crew-ai-cdp-chatbot/chatbot.py).

## Contributing

See [CONTRIBUTING.md](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
