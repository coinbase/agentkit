# Agentkit Extension - LangChain

LangChain extension of AgentKit. Enables agentic workflows to interact with onchain actions.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- Node.js 18 or higher

### Installation

```bash
npm install @coinbase/agentkit-langchain @coinbase/agentkit @langchain @langchain/langgraph @langchain/openai
```

### Environment Setup

Set the following environment variables:

```bash
export OPENAI_API_KEY=<your-openai-api-key>
```

## Usage

### Basic Setup

```typescript
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { AgentKit } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  cdpApiKeyId: "CDP API KEY NAME",
  cdpApiKeySecret: "CDP API KEY SECRET",
});

const tools = await getLangChainTools(agentKit);

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
});

const agent = createReactAgent({
    llm,
    tools,
});
```

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
