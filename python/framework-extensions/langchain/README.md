# AgentKit LangChain Extension

LangChain extension of AgentKit. Enables agentic workflows to interact with onchain actions.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

### Installation

```bash
pip install coinbase-agentkit coinbase-agentkit-langchain
```

### Environment Setup

Set the following environment variables:

```bash
export OPENAI_API_KEY=<your-openai-api-key>
export CDP_API_KEY_NAME=<your-cdp-api-key-name>
export CDP_API_KEY_PRIVATE=<your-cdp-api-key-private>
```

## Usage

### Basic Setup

```python
from coinbase_agentkit import AgentKit
from coinbase_agentkit_langchain import get_langchain_tools

agentKit = AgentKit()

tools = get_langchain_tools(agentKit)

llm = ChatOpenAI(model="gpt-4o-mini")

agent = create_react_agent(
    llm=llm,
    tools=tools,
)
```

For AgentKit configuration options, see the [Coinbase Agentkit README](https://github.com/coinbase/agentkit/blob/master/python/coinbase-agentkit/README.md).

For a full example, see the [chatbot example](https://github.com/coinbase/agentkit/blob/master/python/examples/langchain-smart-wallet-chatbot/chatbot.py).

## Contributing

See [CONTRIBUTING.md](https://github.com/coinbase/agentkit/blob/master/CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
