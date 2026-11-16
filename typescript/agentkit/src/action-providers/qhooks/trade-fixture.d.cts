export function validTrade(
  input: Record<string, unknown>,
  options?: { payToken?: string; now?: number },
): Record<string, unknown>;
export function tamperedTrades(
  input: Record<string, unknown>,
): { name: string; plan: Record<string, unknown> }[];
export function rehash(plan: Record<string, unknown>): Record<string, unknown>;
