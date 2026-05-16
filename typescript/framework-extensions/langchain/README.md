# Agentkit Extension - LangChain

LangChain extension of AgentKit. Enables agentic workflows to interact with onchain actions.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- Node.js 18 or higher

### Installation

```bash
npm install @coinbase/agentkit-langchain @coinbase/agentkit langchain @langchain/langgraph @langchain/openai
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
import { createAgent } from "langchain";
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

const agent = createAgent({
    model: llm,
    tools,
});
```

## Middleware

LangChain agents support [middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in) — hooks that run at specific points in the agent execution flow. Middleware can be used for guardrails, retries, cost control, context management, and more.

```typescript
import { createAgent, toolRetryMiddleware, modelCallLimitMiddleware } from "langchain";

const agent = createAgent({
  model: llm,
  tools,
  middleware: [
    toolRetryMiddleware({ maxRetries: 3 }),
    modelCallLimitMiddleware({ runLimit: 10 }),
  ],
});
```

### Built-in middleware

| Middleware | Use case |
|------------|----------|
| [`humanInTheLoopMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#human-in-the-loop) | Pause for human approval before sensitive tool calls |
| [`piiMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#pii-detection) | Redact, mask, or block PII (emails, credit cards, etc.) |
| [`modelCallLimitMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#model-call-limit) | Cap the number of LLM calls to control costs |
| [`toolCallLimitMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#tool-call-limit) | Limit calls to expensive or sensitive tools |
| [`toolRetryMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#tool-retry) | Retry failed tool calls with exponential backoff |
| [`modelRetryMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#model-retry) | Retry failed model calls with exponential backoff |
| [`modelFallbackMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#model-fallback) | Fall back to alternative models on failure |
| [`summarizationMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#summarization) | Compress conversation history when approaching token limits |
| [`llmToolSelectorMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#llm-tool-selector) | Use an LLM to select relevant tools before calling the main model |
| [`contextEditingMiddleware`](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#context-editing) | Clear older tool outputs to manage context window size |

You can also build [custom middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/custom) with `createMiddleware` for use cases like input validation, guardrails, logging, or dynamic model selection. See the [guardrails chatbot example](../../examples/langchain-guardrails-cdp-chatbot) for a concrete implementation.

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
