import { z } from "zod";

/** Merchant identifiers for informational payee screening. */
export const CheckPayeeSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .optional(),
    name: z.string().min(1).max(200).optional(),
    domain: z.string().min(1).max(253).optional(),
  })
  .refine(input => Boolean(input.address || input.name || input.domain), {
    message: "Supply address, name or domain",
  });

/** A merchant's complete challenge, reviewed without paying that merchant. */
export const PreflightPaymentSchema = z.object({
  challenge: z.record(z.string(), z.unknown()),
  resource_url: z.url(),
  rules: z.record(z.string(), z.unknown()).optional(),
  context: z.object({ spent_today_usd: z.number().nonnegative().optional() }).optional(),
});

/** Provider configuration supplied by the agent operator, not the model. */
export interface SpendPreflightConfig {
  /** Use the shared three-call daily HTTP/MCP trial instead of paying screening fees. */
  trial?: boolean;
}
