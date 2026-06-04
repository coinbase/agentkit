import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ALGOVAULT_CLIENT_INFO } from "./constants";
import { AlgoVaultToolCallOptions, ToolCallResultLike } from "./types";

/**
 * Invokes a single AlgoVault MCP tool over Streamable HTTP and returns its text
 * content. The AlgoVault MCP server requires a full stateful handshake, which
 * the `@modelcontextprotocol/sdk` client manages (session id, SSE, cleanup).
 *
 * @param options - The endpoint, optional API key, tool name, and arguments.
 * @returns The tool's text content (a JSON string on success, or a formatted
 *   error string when the tool reports a structured error).
 */
export async function callAlgoVaultTool(options: AlgoVaultToolCallOptions): Promise<string> {
  const { baseUrl, apiKey, name, arguments: args } = options;

  const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
    requestInit: apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined,
  });

  const client = new Client({ ...ALGOVAULT_CLIENT_INFO }, { capabilities: {} });

  try {
    await client.connect(transport);
    const result = (await client.callTool({ name, arguments: args })) as ToolCallResultLike;
    return extractToolText(result, name);
  } finally {
    // Best-effort cleanup — never mask the original result/error.
    await client.close().catch(() => undefined);
  }
}

/**
 * Extracts the text content from an MCP tool result, surfacing AlgoVault's
 * structured errors when the tool reports one.
 *
 * @param result - The MCP `tools/call` result.
 * @param toolName - The tool name, used for error context.
 * @returns The text content, or a formatted error string.
 */
export function extractToolText(result: ToolCallResultLike, toolName: string): string {
  const content = Array.isArray(result?.content) ? result.content : [];
  const text = content
    .filter(
      (c): c is { type: "text"; text: string } => c?.type === "text" && typeof c.text === "string",
    )
    .map(c => c.text)
    .join("\n")
    .trim();

  if (result?.isError) {
    return formatAlgoVaultToolError(text, toolName);
  }

  if (!text) {
    return `AlgoVault ${toolName} returned an empty response.`;
  }

  return text;
}

/**
 * Formats a structured AlgoVault tool error. AlgoVault returns errors as JSON
 * text with an `error`/`code` message and optional `suggested_*` guidance
 * fields; this surfaces them verbatim so the agent can act on them.
 *
 * @param text - The raw error text returned by the tool.
 * @param toolName - The tool name, used for error context.
 * @returns A human/LLM-readable error string.
 */
export function formatAlgoVaultToolError(text: string, toolName: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const code = parsed.code ?? parsed.error_code;
    const message = parsed.error ?? parsed.message ?? text;
    const suggestions = Object.entries(parsed)
      .filter(([key]) => key.startsWith("suggested_"))
      .map(
        ([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
      );

    const parts = [
      `AlgoVault ${toolName} error${code ? ` [${String(code)}]` : ""}: ${String(message)}`,
    ];
    if (suggestions.length > 0) {
      parts.push(suggestions.join("; "));
    }
    return parts.join(" — ");
  } catch {
    return `AlgoVault ${toolName} error: ${text || "unknown error"}`;
  }
}

/**
 * Formats a transport/protocol-level error (e.g. the request never reached the
 * tool).
 *
 * @param error - The thrown error.
 * @param toolName - The tool name, used for error context.
 * @returns A human/LLM-readable error string.
 */
export function formatAlgoVaultError(error: unknown, toolName: string): string {
  return `AlgoVault ${toolName} request failed: ${
    error instanceof Error ? error.message : String(error)
  }`;
}
