# Coinbase Agentkit Extension - Vercel AI SDK

This package is an extension used to easily plug [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome) into [AI SDK by Vercel](https://sdk.vercel.ai/docs/introduction).

## Installation

For a single command to install all necessary dependencies, run:

```bash
npm install @coinbase/agentkit-vercel-ai-sdk @coinbase/agentkit ai @ai-sdk/openai
```

To break it down, this package is:

```bash
npm install @coinbase/agentkit-vercel-ai-sdk
```

This package is used alongside AgentKit and AI SDK, so these will need to be installed as well.

```bash
npm install @coinbase/agentkit ai
```

Finally, install the model provider you want to use. For example, to use OpenAI, install the `@ai-sdk/openai` package. See [here](https://sdk.vercel.ai/docs/foundations/providers-and-models#ai-sdk-providers) for a list of supported model providers.

```bash
npm install @ai-sdk/openai
```

## Usage

The main export of this package is the `getVercelAITools` function. This function takes an AgentKit instance and returns an object containing the tools for the AgentKit agent. This object can then be passed to AI SDK.

Here's a snippet of code that shows how to use the `getVercelAITools` function to get the tools for the AgentKit agent.

###### chatbot.ts

```typescript
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { AgentKit } from "@coinbase/agentkit";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// Get your Coinbase Developer Platform API key from the Portal: https://portal.cdp.coinbase.com/
// Or, check out one of the other supported wallet providers: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit
const agentKit = await AgentKit.from({
  cdpApiKeyId: process.env.CDP_API_KEY_ID,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
});

const tools = await getVercelAITools(agentKit);

// There are multiple methods to generate text with AI SDK.
// See here for more information: https://sdk.vercel.ai/docs/ai-sdk-core/generating-text
const { text } = await generateText({
  model: openai("gpt-4o-mini"), // Make sure to have OPENAI_API_KEY set in your environment variables
  system: "You are an onchain AI assistant with access to a wallet.",
  prompt: "Print wallet details",
  tools,
  // Allow multi-step tool usage
  // See: https://sdk.vercel.ai/docs/foundations/agents#multi-step-tool-usage
  maxSteps: 10,
});

console.log(text);
```

For a full example, see the [AgentKit AI SDK Chatbot Example](https://github.com/coinbase/agentkit/tree/main/typescript/examples/vercel-ai-sdk-smart-wallet-chatbot).

## Contributing

We welcome contributions of all kinds! Please see our [Contributing Guide](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
