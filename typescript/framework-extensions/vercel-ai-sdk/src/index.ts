/**
 * Main exports for the CDP Vercel AI SDK package
 */

import { z } from "zod";
import { AgentKit, type Action } from "@coinbase/agentkit";
import { tool, type ToolSet } from "ai";

/**
 * Get Vercel AI SDK tools from an AgentKit instance
 *
 * @param agentKit - The AgentKit instance
 * @returns An array of Vercel AI SDK tools
 */
export function getVercelAITools(agentKit: AgentKit): ToolSet {
  const actions: Action[] = agentKit.getActions();
  return actions.reduce((acc, action) => {
    acc[action.name] = tool({
      description: action.description,
      parameters: action.schema,
      execute: async (args: z.output<typeof action.schema>) => {
        const result = await action.invoke(args);
        return result;
      },
    });
    return acc;
  }, {});
}
