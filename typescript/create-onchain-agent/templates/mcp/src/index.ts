import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import { getAgentKit } from "./getAgentKit.js";

/**
 * This is the main entry point for the MCP agent.
 * It creates a new agent and starts the server.
 */
async function main() {
  const agentKit = await getAgentKit();

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

  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      return toolHandler(request.params.name, request.params.arguments);
    } catch (error) {
      throw new Error(`Tool ${request.params.name} failed: ${error}`);
    }
  });

  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch(console.error);
