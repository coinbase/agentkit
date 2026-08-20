import { z } from "zod";

/**
 * List open TaskMarket tasks with optional filters.
 */
export const ListTasksSchema = z
  .object({
    limit: z
      .number()
      .min(1)
      .max(50)
      .nullable()
      .describe("Max tasks to return (1-50). Defaults to 10."),
    mode: z
      .enum(["ALL", "bounty", "claim", "pitch", "benchmark", "auction"])
      .nullable()
      .describe("Task mode filter. Defaults to ALL."),
    sort: z
      .enum(["newest", "reward_desc", "reward_asc", "deadline_asc"])
      .nullable()
      .describe("Sort order. Defaults to reward_desc for earning flows."),
    tags: z
      .string()
      .nullable()
      .describe("Optional comma-separated tags, e.g. 'ai,agents,crypto'."),
    minRewardUsdc: z
      .number()
      .nullable()
      .describe("Optional minimum reward in human USDC (e.g. 1 = 1 USDC)."),
  })
  .strict();

/**
 * Fetch one task by 0x-prefixed 32-byte id.
 */
export const GetTaskSchema = z
  .object({
    taskId: z
      .string()
      .describe(
        "Task ID: 0x-prefixed 32-byte hex from list_tasks or taskmarket.dev",
      ),
  })
  .strict();

/**
 * Summarize whether a natural-language user request is a good TaskMarket delegation.
 * Pure reasoning helper — does not create or fund a task.
 */
export const SuggestDelegationSchema = z
  .object({
    userRequest: z
      .string()
      .describe("The user request the agent is considering handling itself."),
    estimatedLocalEffortHours: z
      .number()
      .nullable()
      .describe("Rough hours if the agent does the work with local tools."),
    budgetUsdc: z
      .number()
      .nullable()
      .describe("Max USDC the user authorized for external work, if any."),
  })
  .strict();
