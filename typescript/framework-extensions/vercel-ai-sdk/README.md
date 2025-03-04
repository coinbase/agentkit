# AgentKit Extension - Vercel AI SDK Toolkit

Vercel AI SDK extension of AgentKit. Enables agentic workflows to interact with onchain actions.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- Node.js 18 or higher

### Installation

```bash
npm install @coinbase/agentkit-vercel-ai-sdk
```

### Environment Setup

Set the following environment variables:

```bash
export CDP_API_KEY_NAME=<your-api-key-name>
export CDP_API_KEY_PRIVATE_KEY=$'<your-private-key>'
export NETWORK_ID=base-sepolia  # Optional: Defaults to base-sepolia
```

## Usage

### Basic Setup

```typescript
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { AgentKit } from "@coinbase/agentkit";

// Initialize CDP AgentKit
const agentkit = await AgentKit.configureWithWallet();

// Get available tools
const tools = await getVercelAITools(agentkit);
```

The toolkit provides access to all CDP AgentKit tools in a Vercel AI SDK compatible format.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines. 