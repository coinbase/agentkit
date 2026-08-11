import { z } from "zod";

const TaskIdSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Task ID must be a 0x-prefixed 32-byte hex value")
  .describe("TaskMarket task ID (0x-prefixed 32-byte hex value)");

export const DiscoverTaskMarketTasksSchema = z
  .object({
    keyword: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .describe("Optional case-insensitive text filter for task descriptions and tags"),
    maxRewardUsdc: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .describe("Optional maximum gross reward in USDC"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .describe("Maximum number of tasks to return; defaults to 20"),
  })
  .describe("Filters for discovering open TaskMarket tasks");

export const GetTaskMarketTaskSchema = z
  .object({
    taskId: TaskIdSchema,
  })
  .describe("The exact TaskMarket task to inspect");

export type DiscoverTaskMarketTasks = z.infer<typeof DiscoverTaskMarketTasksSchema>;
