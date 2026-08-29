# Coinbase Agentkit Extension - Mastra

This package is an extension used to easily plug [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome) into [Mastra](https://mastra.ai/), the TypeScript AI agent framework.

## Installation

For a single command to install all necessary dependencies, run:

```bash
npm install @coinbase/agentkit-mastra @coinbase/agentkit @mastra/core @ai-sdk/openai
```

To break it down, this package is:

```bash
npm install @coinbase/agentkit-mastra
```

This package is used alongside AgentKit and Mastra, so these will need to be installed as well.

```bash
npm install @coinbase/agentkit @mastra/core
```

Finally, install the model provider you want to use. For example, to use OpenAI, install the `@ai-sdk/openai` package. See [here](https://mastra.ai/docs) for more information on Mastra's supported model providers.

```bash
npm install @ai-sdk/openai
```

## Usage

The main export of this package is the `getMastraTools` function. This function takes an AgentKit instance and returns a record of Mastra-compatible tools. These tools can then be passed directly to a Mastra agent.

Here's a snippet of code that shows how to use the `getMastraTools` function to get the tools for the AgentKit agent.

###### agent.ts

```typescript
import { getMastraTools } from "@coinbase/agentkit-mastra";
import { AgentKit } from "@coinbase/agentkit";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// Get your Coinbase Developer Platform API key from the Portal: https://portal.cdp.coinbase.com/
// Or, check out one of the other supported wallet providers: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit
const agentKit = await AgentKit.from({
  cdpApiKeyId: process.env.CDP_API_KEY_ID,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
});

const tools = getMastraTools(agentKit);

const agent = new Agent({
  name: "Onchain Agent",
  instructions: "You are an onchain AI assistant with access to a wallet.",
  model: openai("gpt-4o-mini"), // Make sure to have OPENAI_API_KEY set in your environment variables
  tools,
});

const response = await agent.generate("Print wallet details");
console.log(response.text);
```

## Contributing

We welcome contributions of all kinds! Please see our [Contributing Guide](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
