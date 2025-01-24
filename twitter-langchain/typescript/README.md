# Twitter (X) Langchain Toolkit

Twitter integration with Langchain to enable agentic workflows using the core primitives defined in `cdp-agentkit-core`.

This toolkit contains tools that enable an LLM agent to interact with [Twitter](https://developer.x.com/en/docs/x-api). The toolkit provides a wrapper around the Twitter (X) API, allowing agents to perform social operations like posting text.

## Setup

### Prerequisites

- [OpenAI API Key](https://platform.openai.com/api-keys)
- [Twitter (X) App Developer Keys](https://developer.x.com/en/portal/dashboard)
- Node.js 18 or higher

### Installation

```bash
npm install @coinbase/twitter-langchain
```

### Environment Setup

Set the following environment variables:

```bash
export OPENAI_API_KEY=<your-openai-api-key>
export TWITTER_API_KEY=<your-api-key>
export TWITTER_API_SECRET=<your-api-secret>
export TWITTER_ACCESS_TOKEN=<your-access-token>
export TWITTER_ACCESS_TOKEN_SECRET=<your-access-token-secret>
export TWITTER_BEARER_TOKEN=<your-bearer-token>
```

## Usage

### Basic Setup

```typescript
import { TwitterAgentkit } from "@coinbase/cdp-agentkit-core";
import { TwitterToolkit } from "@coinbase/twitter-langchain";

// Initialize Twitter AgentKit
const agentkit = new TwitterAgentkit();

// Create toolkit
const toolkit = new TwitterToolkit(agentkit);

// Get available tools
const tools = toolkit.getTools();
```

### Available Tools

The toolkit provides the following tools:

1. **account_details** - Get the authenticated account details
2. **account_mentions** - Get mentions for the account
3. **post_tweet** - Post a tweet to the account
3. **post_tweet_reply** - Post a reply to a tweet on Twitter

### Using with an Agent

#### Additional Installations

```bash
npm install @langchain/langgraph @langchain/openai
```

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Initialize LLM
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

// Create agent executor
const agent = createReactAgent({
  llm: model,
  tools,
});

// Example usage
const result = await agent.invoke({
  messages: [new HumanMessage("please post 'hello, world!' to twitter")],
});

console.log(result.messages[result.messages.length - 1].content);
```

## Examples

Check out [twitter-langchain/examples](./examples) for inspiration and help getting started!
- [Chatbot Typescript](./examples/chatbot-typescript/README.md): Simple example of a Node.js Chatbot that can interact on Twitter (X), using OpenAI.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
