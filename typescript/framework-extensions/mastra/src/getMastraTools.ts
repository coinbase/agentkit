/**
 * Main exports for the CDP Mastra package
 */

import { z } from "zod";
import { AgentKit, type Action } from "@coinbase/agentkit";
import { createTool } from "@mastra/core/tools";

/**
 * The return type of getMastraTools - a record mapping action names to Mastra tools
 */
export type MastraToolSet = Record<string, ReturnType<typeof createTool>>;

/**
 * Get Mastra tools from an AgentKit instance
 *
 * @param agentKit - The AgentKit instance
 * @returns A record of Mastra tools keyed by action name, compatible with Mastra agents
 */
export function getMastraTools(agentKit: AgentKit): MastraToolSet {
  const actions: Action[] = agentKit.getActions();
  return actions.reduce<MastraToolSet>((acc, action) => {
    acc[action.name] = createTool({
      id: action.name,
      description: action.description,
      inputSchema: action.schema,
      execute: async (arg: z.output<typeof action.schema>) => {
        const result = await action.invoke(arg);
        return result;
      },
    });
    return acc;
  }, {});
}
