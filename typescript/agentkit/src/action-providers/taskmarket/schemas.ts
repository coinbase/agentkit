import { z } from "zod";

/**
 * Input schema for listing/browsing Taskmarket tasks.
 */
export const ListTasksSchema = z
  .object({
    mode: z
      .enum(["bounty", "claim", "pitch", "benchmark", "auction"])
      .optional()
      .describe("Optional task mode to filter by"),
    maxRewardUsdc: z
      .number()
      .positive()
      .optional()
      .describe("Optional maximum reward in whole USDC to filter by"),
    search: z
      .string()
      .min(1)
      .optional()
      .describe("Optional substring to search for in task descriptions"),
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor returned by a previous list_tasks call"),
  })
  .strict();

/**
 * Input schema for fetching the live status of one Taskmarket task.
 */
export const GetTaskSchema = z
  .object({
    taskId: z.string().min(1).describe("The Taskmarket task id (0x-prefixed)"),
  })
  .strict();

/**
 * Input schema for listing submissions of a Taskmarket task for review.
 */
export const ListSubmissionsSchema = z
  .object({
    taskId: z.string().min(1).describe("The Taskmarket task id (0x-prefixed)"),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Maximum number of submissions to return (default 50)"),
  })
  .strict();

/**
 * Input schema for creating a Taskmarket task as a requester.
 *
 * Every write is gated by explicit user authorization and a hard max-spend
 * cap so the agent can never silently fund on-chain work.
 */
export const CreateTaskSchema = z
  .object({
    description: z.string().min(1).max(10000).describe("The task description shown to workers"),
    rewardUsdc: z
      .number()
      .positive()
      .describe("The reward offered to the completing worker in whole USDC (e.g. 5 for 5 USDC)"),
    durationHours: z
      .number()
      .positive()
      .describe("How long the task stays open, in hours from creation"),
    mode: z
      .enum(["bounty", "claim", "pitch", "benchmark", "auction"])
      .optional()
      .describe("Task mode (default bounty)"),
    taskVisibility: z
      .enum(["public", "unlisted", "private"])
      .optional()
      .describe("Who can see the task exists (default public)"),
    submissionVisibility: z
      .enum(["public", "reveal_all", "winner_only", "never"])
      .optional()
      .describe("Who can see submissions (default public)"),
    tags: z
      .array(z.string().min(1).max(32))
      .max(10)
      .optional()
      .describe("Optional up to 10 tags to help workers discover the task"),
    maxSpendUsdc: z
      .number()
      .positive()
      .optional()
      .describe(
        "Hard cap on the total spend in USDC for this task. Defaults to the provider limit.",
      ),
    authorization: z
      .string()
      .min(1)
      .describe(
        "Explicit, fresh user authorization. Must contain the exact phrase 'I authorize paying <total> USDC' where <total> is the total cost returned by the plan. The action refuses to create anything without it.",
      ),
  })
  .strict();
