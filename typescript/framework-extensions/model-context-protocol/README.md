# AgentKit Extension - Model Context Protocol (MCP)

Anthropic Model Context Protocol (MCP) extension of AgentKit. Enables agentic workflows to interact with onchain actions.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- Node.js 18 or higher

### Installation

```bash
npm install @coinbase/agentkit-model-context-protocol @coinbase/agentkit @modelcontextprotocol/sdk
```

## Usage

### Basic Setup

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import { AgentKit } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  cdpApiKeyId: "CDP API KEY NAME",
  cdpApiKeySecret: "CDP API KEY SECRET",
});

const { tools, toolHandler } = await getMcpTools(agentKit);

const server = new Server(
  {
    name: "agentkit",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    return toolHandler(request.params.name, request.params.arguments);
  } catch (error) {
    throw new Error(`Tool ${name} failed: ${error}`);
  }
});

const transport = new StdioServerTransport();

await server.connect(transport);
```

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
