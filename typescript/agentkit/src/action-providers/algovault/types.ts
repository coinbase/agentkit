/**
 * Configuration options for the AlgoVaultActionProvider.
 */
export interface AlgoVaultActionProviderConfig {
  /**
   * Optional AlgoVault API key. The free tier is keyless (no key required), so
   * this is only needed to unlock paid-tier limits. Falls back to the
   * `ALGOVAULT_API_KEY` environment variable when omitted.
   */
  apiKey?: string;

  /**
   * Optional override for the AlgoVault MCP endpoint. Defaults to
   * `https://api.algovault.com/mcp`.
   */
  baseUrl?: string;
}

/**
 * Options for a single AlgoVault MCP tool invocation.
 */
export interface AlgoVaultToolCallOptions {
  /**
   * The AlgoVault MCP endpoint to call.
   */
  baseUrl: string;

  /**
   * Optional API key sent as a bearer token (paid tiers).
   */
  apiKey?: string;

  /**
   * The name of the AlgoVault MCP tool to invoke.
   */
  name: string;

  /**
   * The arguments for the tool, matching its input schema.
   */
  arguments: Record<string, unknown>;
}

/**
 * Minimal shape of an MCP `tools/call` result, as returned by the
 * `@modelcontextprotocol/sdk` client.
 */
export interface ToolCallResultLike {
  /**
   * The content blocks returned by the tool.
   */
  content?: Array<{ type?: string; text?: string }>;

  /**
   * Whether the tool reported an error.
   */
  isError?: boolean;
}
