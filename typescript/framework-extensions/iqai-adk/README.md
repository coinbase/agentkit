# AgentKit Extension - IQAI ADK

IQAI ADK extension of AgentKit. Enables agentic workflows to interact with onchain actions.
This extension allows you to use AgentKit's blockchain capabilities with ADK-TS's advanced workflow orchestration, including:

- **Sequential Agents**: Execute agents one after another
- **Parallel Agents**: Run multiple agents simultaneously
- **Loop Agents**: Iterative refinement until conditions are met
- **LangGraph Agents**: Complex workflows with conditional branching and state management

Learn more at [https://adk.iqai.com/](https://adk.iqai.com/)

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- Node.js 22 or higher

### Installation

```bash
pnpm install @coinbase/agentkit-iqai-adk @coinbase/agentkit @iqai/adk
```

## Usage

### Basic Setup

```typescript
import { getAdkTools } from "@coinbase/agentkit-iqai-adk";
import { LlmAgent } from "@iqai/adk";
import { AgentKit, CdpEvmWalletProvider } from "@coinbase/agentkit";

// Initialize AgentKit with a wallet provider
const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
  networkId: "base-sepolia",
});

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    /* your action providers */
  ],
});

// Convert AgentKit actions to ADK-TS tools
const tools = getAdkTools(agentKit);

// Create an ADK-TS agent with blockchain capabilities
const agent = new LlmAgent({
  name: "blockchain-agent",
  model: "gemini-2.5-flash",
  tools,
  instruction: "You are a helpful blockchain agent that can interact onchain.",
});

// Use the agent
const result = await agent.run({ message: "What's my wallet balance?" });
```

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
