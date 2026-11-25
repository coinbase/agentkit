import { z } from "zod";
import { PreflightPaymentSchema, PreflightResultSchema, SpendPreflightConfig } from "./schemas";

/**
 * Creates a fixed-origin screening client with no wallet or default network transport.
 *
 * @param config - Explicit application-owned transport and rules.
 * @returns A reviewer that holds offline or on unavailable/malformed screening.
 */
export function createPreflightReviewer(config: SpendPreflightConfig = {}) {
  const transport = config.screeningFetch;
  const rules = structuredClone(config.rules ?? {});
  return async (args: z.infer<typeof PreflightPaymentSchema>) => {
    const hold = (reason: string) => ({ decision: "hold" as const, reasons: [reason] });
    if (!transport) return hold("offline: screening client not configured");
    try {
      const input = PreflightPaymentSchema.parse(args);
      const body = JSON.stringify({ ...input, rules });
      if (new TextEncoder().encode(body).length > 65536) return hold("input limit exceeded");
      const response = await transport("https://api.spendpreflight.com/v1/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok || !response.body) return hold("screening unavailable");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      let next = await reader.read();
      while (!next.done) {
        const value = next.value;
        size += value.length;
        if (size > 131072) {
          await reader.cancel();
          return hold("response limit exceeded");
        }
        chunks.push(value);
        next = await reader.read();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const result = PreflightResultSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
      if (result.decision === "allow" && !result.receipt) return hold("missing decision receipt");
      return result;
    } catch {
      return hold("screening unavailable or invalid");
    }
  };
}
