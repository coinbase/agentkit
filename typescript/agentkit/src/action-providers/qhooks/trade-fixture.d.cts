export function validTrade(
  input: Record<string, unknown>,
  options?: { payToken?: string; now?: number },
): Record<string, unknown>;
export function tamperedTrades(
  input: Record<string, unknown>,
): { name: string; plan: Record<string, unknown> }[];
export function rehash(plan: Record<string, unknown>): Record<string, unknown>;

export function independentRead(
  input: Record<string, unknown>,
  options?: { payToken?: string; now?: number },
): (name: string, args: Record<string, unknown>) => Record<string, unknown>;
export function fixtureFetch(
  plan: Record<string, unknown>,
  input: Record<string, unknown>,
  transport: "mcp" | "rest",
  onCall?: (name: string, args: Record<string, unknown>) => void,
): typeof fetch;
