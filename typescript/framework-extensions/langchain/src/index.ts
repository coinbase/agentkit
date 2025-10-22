/**
 * Main exports for the CDP Langchain package
 */

import { z } from "zod";
import { StructuredTool, tool } from "@langchain/core/tools";
import { AgentKit, Action } from "@coinbase/agentkit";

/**
 * Get Langchain tools from an AgentKit instance
 *
 * @param agentKit - The AgentKit instance
 * @returns An array of Langchain tools
 */
export async function getLangChainTools(agentKit: AgentKit): Promise<StructuredTool[]> {
  const actions: Action[] = agentKit.getActions();
  return actions.map(action =>
    tool(
      async (arg: z.output<typeof action.schema>) => {
        const result = await action.invoke(arg);
        return result;
      },
      {
        name: action.name,
        description: action.description,
        schema: action.schema,
      },
    ),
  );
}
