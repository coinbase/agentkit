/** A tool returned an error result (`isError: true`); the message explains why, e.g. "holds 0 I5". */
export class IndexfyToolError extends Error {}

/** One unsigned call from a `build_*` tool. */
export interface BuiltCall {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  description: string;
}

/** The shape every `build_*` tool returns. */
export interface BuiltTransaction {
  chainId: number;
  from: string;
  calls: BuiltCall[];
  simulation?: { status: string; error?: string; reason?: string };
  summary: Record<string, unknown>;
  notes?: string[];
}

/** The fields of an index this provider relies on. */
export interface IndexInfo {
  address: string;
  name: string;
  symbol: string;
}

/**
 * Calls a tool on the Indexfy MCP server with one JSON-RPC `tools/call` request.
 *
 * @param url - The MCP endpoint
 * @param name - The tool name, e.g. "build_buy_index"
 * @param args - The tool arguments
 * @returns The tool's result, parsed from JSON when it is JSON
 */
export async function callIndexfyTool<T = unknown>(
  url: string,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  if (!res.ok) {
    throw new Error(`Indexfy API ${res.status} ${res.statusText}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    result?: { content?: { type: string; text?: string }[]; isError?: boolean };
    error?: { message?: string };
  };
  if (body.error) {
    throw new Error(`Indexfy API error: ${body.error.message ?? JSON.stringify(body.error)}`);
  }

  const text = body.result?.content?.find(c => c.type === "text")?.text ?? "";
  if (body.result?.isError) throw new IndexfyToolError(text || `${name} failed`);

  try {
    return JSON.parse(text) as T;
  } catch {
    // Some tools answer in plain text.
    return text as T;
  }
}
