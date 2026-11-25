import { z } from "zod";
import { SPEND_GUARD_ACTIONS, SPEND_GUARD_ROOTS } from "./constants";

/**
 * One limit operation inside a guarded batch.
 */
export const SpendOrderSchema = z
  .object({
    root: z.enum(SPEND_GUARD_ROOTS).describe("Which limit the operation touches"),
    action: z
      .enum(SPEND_GUARD_ACTIONS)
      .optional()
      .describe("READ by default; SET/INCREASE/DECREASE change the limit"),
    value: z
      .number()
      .optional()
      .describe("Value in the limit's own scale (BUDGET.USD scale 100: 73.50 -> 7350)"),
    value_dec: z.number().optional().describe("Value in human units (73.5 USD -> 73.5)"),
    lock: z
      .boolean()
      .optional()
      .describe("When true, a violation trips the tenant's circuit breaker"),
  })
  .strict();

/**
 * Input schema for guard_batch.
 */
export const GuardBatchSchema = z
  .object({
    orders: z
      .array(SpendOrderSchema)
      .min(1)
      .max(256)
      .describe("Limit operations to validate and apply atomically"),
    tenant: z
      .number()
      .int()
      .min(0)
      .max(63)
      .optional()
      .describe("Tenant slot for the state; 0 by default"),
  })
  .strict();
