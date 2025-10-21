/**
 * Main exports for the CDP ADK-TS package
 */

import { type BaseTool, convertMcpToolToBaseTool } from "@iqai/adk";
import { AgentKit } from "@coinbase/agentkit";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";

export type AdkTool = BaseTool;

/**
 * Get ADK-TS tools from an AgentKit instance
 *
 * @param agentKit - The AgentKit instance
 * @returns An array of ADK BaseTool instances
 */
export async function getAdkTools(agentKit: AgentKit): Promise<BaseTool[]> {
  const { tools, toolHandler } = await getMcpTools(agentKit);

  const baseTools = await Promise.all(
    tools.map(async mcpTool => convertMcpToolToBaseTool({ mcpTool, toolHandler: toolHandler })),
  );

  return baseTools;
}
