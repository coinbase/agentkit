import { z } from "zod";

const taskId = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected a TaskMarket task id");

export const TaskMarketListTasksSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  minRewardUsdc: z.number().nonnegative().optional(),
  maxRewardUsdc: z.number().nonnegative().optional(),
  deadlineHours: z.number().positive().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const TaskMarketTaskSchema = z.object({ taskId });

export const TaskMarketDelegateSchema = z.object({
  description: z.string().trim().min(1).max(20_000),
  rewardUsdc: z.number().positive(),
  durationHours: z.number().positive(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  maxSpendUsdc: z.number().positive(),
  /** Must be true in the same invocation that authorizes the adapter to spend. */
  confirm: z.boolean().default(false),
});

export type TaskMarketListTasksInput = z.infer<typeof TaskMarketListTasksSchema>;
export type TaskMarketTaskInput = z.infer<typeof TaskMarketTaskSchema>;
export type TaskMarketDelegateInput = z.infer<typeof TaskMarketDelegateSchema>;
