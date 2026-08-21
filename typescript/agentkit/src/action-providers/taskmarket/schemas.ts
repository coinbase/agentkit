import { z } from "zod";

/**
 * Input schema for fetching open TaskMarket tasks.
 */
export const FetchOpenTasksSchema = z
  .object({
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe("Maximum number of tasks to return (default 20, max 100)"),
    query: z
      .string()
      .optional()
      .describe("Optional keyword to filter open tasks by (matches task description)"),
    minReward: z
      .number()
      .nonnegative()
      .optional()
      .describe("Minimum reward (in MOLT) to filter by"),
  })
  .strict();

/**
 * Input schema for getting a single TaskMarket task.
 */
export const GetTaskSchema = z
  .object({
    taskId: z.string().describe("The full TaskMarket task id (0x-prefixed hex)"),
  })
  .strict();
