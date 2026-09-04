import { z } from "zod";

import { MAX_TASKS_RETURNED } from "./constants";

/**
 * Input schema for browsing open TaskMarket work.
 */
export const BrowseTasksSchema = z
  .object({
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_TASKS_RETURNED)
      .default(10)
      .describe(`Maximum number of tasks to return (1-${MAX_TASKS_RETURNED}).`),
    minRewardUsdc: z
      .number()
      .nonnegative()
      .optional()
      .describe("Only return tasks whose net reward is at least this many USDC."),
    keyword: z
      .string()
      .optional()
      .describe("Case-insensitive substring to match against the task description."),
  })
  .describe("Input schema for browsing open work on TaskMarket");

/**
 * Input schema for fetching a single task by id.
 */
export const GetTaskSchema = z
  .object({
    taskId: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Task id must be a 0x-prefixed 32-byte hex string.")
      .describe("The TaskMarket task id, a 0x-prefixed 32-byte hex string."),
  })
  .describe("Input schema for retrieving one TaskMarket task");

/**
 * Input schema for the delegation check.
 */
export const EvaluateDelegationSchema = z
  .object({
    workDescription: z
      .string()
      .min(3)
      .describe("A short description of the work you are considering delegating."),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_TASKS_RETURNED)
      .default(5)
      .describe("Maximum number of candidate tasks to return."),
  })
  .describe("Input schema for checking whether open TaskMarket work matches a job at hand");
