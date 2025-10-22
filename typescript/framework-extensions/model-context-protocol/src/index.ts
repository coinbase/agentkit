/**
 * Main exports for the AgentKit Model Context Protocol (MCP) Extension package
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { AgentKit, Action } from "@coinbase/agentkit";

/**
 * The AgentKit MCP tools and tool handler
 */
interface AgentKitMcpTools {
  tools: Tool[];
  toolHandler: (name: string, args: unknown) => Promise<CallToolResult>;
}

/**
 * Get Model Context Protocol (MCP) tools from an AgentKit instance
 *
 * @param agentKit - The AgentKit instance
 * @returns An array of tools and a tool handler
 */
export async function getMcpTools(agentKit: AgentKit): Promise<AgentKitMcpTools> {
  const actions: Action[] = agentKit.getActions();

  return {
    tools: actions.map(action => {
      return {
        name: action.name,
        description: action.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: zodToJsonSchema(action.schema as any),
      } as Tool;
    }),
    toolHandler: async (name: string, args: unknown) => {
      const action = actions.find(action => action.name === name);
      if (!action) {
        throw new Error(`Tool ${name} not found`);
      }

      const parsedArgs = action.schema.parse(args);

      const result = await action.invoke(parsedArgs);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    },
  };
}
