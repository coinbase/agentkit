import { z } from "zod";

/**
 * Supported task lifecycle phases exposed by the Taskmarket API.
 */
export const TaskmarketPhaseSchema = z.enum([
  "active",
  "in_review",
  "awaiting_settlement",
  "resolved",
]);

/**
 * Input schema for discovering open or historical Taskmarket work.
 */
export const ListTaskmarketTasksSchema = z
  .object({
    status: z
      .string()
      .optional()
      .describe("Task status filter, for example 'open' or 'completed'. Defaults to 'open'."),
    phase: TaskmarketPhaseSchema.optional().describe("Optional lifecycle phase filter."),
    mode: z
      .enum(["bounty", "claim", "pitch", "benchmark", "auction", "ALL"])
      .optional()
      .describe("Optional task competition mode filter."),
    tags: z.array(z.string()).max(20).optional().describe("Optional task tags to match."),
    minRewardUsdc: z
      .number()
      .nonnegative()
      .finite()
      .optional()
      .describe("Optional minimum reward in whole USDC."),
    maxRewardUsdc: z
      .number()
      .nonnegative()
      .finite()
      .optional()
      .describe("Optional maximum reward in whole USDC."),
    deadlineHours: z
      .number()
      .positive()
      .finite()
      .optional()
      .describe("Only return tasks whose deadline is within this many hours."),
    sort: z
      .enum(["newest", "reward_desc", "reward_asc", "deadline_asc"])
      .optional()
      .describe("Result ordering. Defaults to newest."),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe("Maximum number of tasks to return, up to 100."),
    cursor: z.string().optional().describe("Pagination cursor returned by a previous call."),
  })
  .strict();

/**
 * Input schema for retrieving one Taskmarket task by id.
 */
export const GetTaskmarketTaskSchema = z
  .object({
    taskId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Task id must be a 32-byte hex value.")
      .describe("Taskmarket task id."),
  })
  .strict();

/**
 * Input schema for creating a Taskmarket task.
 */
export const CreateTaskmarketTaskSchema = z
  .object({
    description: z.string().min(1).max(50_000).describe("The work specification for the task."),
    rewardUsdc: z
      .number()
      .positive()
      .finite()
      .describe("Escrow reward in whole USDC; the same amount is paid through x402."),
    durationHours: z
      .number()
      .positive()
      .finite()
      .max(24 * 365)
      .describe("How many hours the task remains open."),
    mode: z
      .enum(["bounty", "claim", "pitch", "benchmark", "auction"])
      .optional()
      .describe("Task competition mode; defaults to bounty."),
    tags: z.array(z.string()).max(20).optional().describe("Optional discovery tags."),
    taskVisibility: z
      .enum(["public", "unlisted", "private"])
      .optional()
      .describe("Task visibility; defaults to public."),
    confirm: z
      .boolean()
      .describe(
        "Must be true only after the user explicitly approves creating the task and escrow payment.",
      ),
  })
  .strict();
