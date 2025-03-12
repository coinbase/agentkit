# Messari Action Provider

The Messari Action Provider enables AI agents to query the [Messari AI toolkit](https://messari.io/) for crypto market research data. This provider allows agents to ask research questions about market data, statistics, rankings, historical trends, and information about specific protocols, tokens, or platforms.

## Getting an API Key

To use the Messari Action Provider, you need to obtain a Messari API key by following these steps:

1. Sign up for a Messari account at [messari.io](https://messari.io/)
2. After signing up, navigate to [messari.io/account/api](https://messari.io/account/api)
3. Generate your API key from the account dashboard

Different subscription tiers provide different levels of access to the API. See the [Rate Limiting](#rate-limiting) section for details.

## Configuration

Once you have your Messari API key, you can configure the provider in two ways:

### 1. Environment Variable

Set the `MESSARI_API_KEY` environment variable:

```bash
MESSARI_API_KEY=your_messari_api_key
```

### 2. Direct Configuration

Pass the API key directly when initializing the provider:

```typescript
import { messariActionProvider } from "@coinbase/agentkit";

const provider = messariActionProvider({
  apiKey: "your_messari_api_key",
});
```

## Rate Limiting

The Messari API has rate limits based on your subscription tier:

| Subscription Tier | Daily Request Limit |
|-------------------|---------------------|
| Free (Unpaid)     | 2 requests per day  |
| Lite              | 10 requests per day |
| Pro               | 20 requests per day |
| Enterprise        | 50 requests per day |

If you need more than 50 requests per day, you can contact Messari's sales team to discuss a custom credit allocation system for your specific needs.

## Actions

### `research_question`

This action allows the agent to query the Messari AI toolkit with a research question about crypto markets, protocols, or tokens.

#### Input Schema

| Parameter | Type   | Description                                                  |
|-----------|--------|--------------------------------------------------------------|
| question  | string | The research question about crypto markets, protocols, or tokens |

#### Example Usage

```typescript
import { AgentKit, messariActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

// Initialize AgentKit with the Messari action provider
const agentkit = await AgentKit.from({
  actionProviders: [messariActionProvider()],
});

// Get LangChain tools from AgentKit
const tools = await getLangChainTools(agentkit);

// Create a LangChain agent with the tools
const llm = new ChatOpenAI({ model: "gpt-4o-mini" });
const agent = createReactAgent({
  llm,
  tools,
});

// The agent can now use the Messari research_question action
// Example prompt: "What is the current price of Ethereum?"
```

#### Example Response

```
Messari Research Results:

Ethereum (ETH) has shown strong performance over the past month with a 15% price increase. The current price is approximately $3,500, up from $3,000 at the beginning of the month. Trading volume has also increased by 20% in the same period.
```

## Network Support

The Messari Action Provider is network-agnostic, meaning it supports all networks. The research capabilities are not tied to any specific blockchain network. 