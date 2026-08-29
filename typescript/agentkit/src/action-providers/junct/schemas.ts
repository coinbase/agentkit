import { z } from "zod";

export const JunctListServersSchema = z
  .object({})
  .strict()
  .describe("No inputs required. Returns all available Junct DeFi MCP servers.");

export const JunctCallToolSchema = z
  .object({
    serverUrl: z
      .string()
      .describe("The Junct MCP server URL (e.g. https://aave.mcp.junct.dev/mcp)"),
    toolName: z.string().describe("The name of the tool to invoke"),
    toolArgs: z
      .record(z.unknown())
      .default({})
      .describe("Arguments to pass to the tool as a JSON object"),
  })
  .strict();

export const JunctListToolsSchema = z
  .object({
    serverUrl: z
      .string()
      .describe("The Junct MCP server URL to list tools from"),
  })
  .strict();
