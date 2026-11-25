import { z } from "zod";

/** A challenge to review, never a destination for a request or payment. */
export const PreflightPaymentSchema = z.object({
  challenge: z.record(z.string(), z.unknown()),
  resource_url: z.url().refine(value => new URL(value).protocol === "https:"),
});

/** Operator-owned configuration; none of these controls are model inputs. */
export interface SpendPreflightConfig {
  /** Explicitly authorized, separately budgeted client for the paid screening API. */
  screeningFetch?: typeof fetch;
  /** Spending rules supplied by the application, not the model. */
  rules?: Record<string, unknown>;
}

/** Informational result; an allow does not execute or authorize a wallet operation. */
export const PreflightResultSchema = z.object({
  decision: z.enum(["allow", "hold", "block"]),
  reasons: z.array(z.string()),
  receipt: z
    .object({ id: z.string().min(1) })
    .passthrough()
    .optional(),
});
