import { z } from "zod";

/**
 * Input schema for listing Taskmarket tasks.
 */
export const ListTaskmarketTasksSchema = z
  .object({
    status: z
      .enum([
        "open",
        "claimed",
        "worker_selected",
        "pending_approval",
        "review",
        "appealing",
        "disputed",
        "completed",
        "expired",
        "cancelled",
        "ALL",
      ])
      .optional()
      .describe("Filter by task status. Defaults to open."),
    mode: z
      .enum(["ALL", "bounty", "claim", "pitch", "benchmark", "auction"])
      .optional()
      .describe("Filter by task mode."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of tasks to return (1-50)."),
    rewardMinUsdc: z
      .number()
      .nonnegative()
      .optional()
      .describe("Minimum reward in whole USDC units."),
    tags: z.string().optional().describe("Optional comma-separated tags."),
  })
  .describe("Input schema for listing Taskmarket tasks");

/**
 * Input schema for fetching a single Taskmarket task.
 */
export const GetTaskmarketTaskSchema = z
  .object({
    taskId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "taskId must be a 0x-prefixed 32-byte hex id")
      .describe("Taskmarket task id"),
  })
  .describe("Input schema for fetching one Taskmarket task");

/**
 * Input schema for previewing a Taskmarket task before any funds move.
 */
export const PreviewTaskmarketTaskSchema = z
  .object({
    description: z
      .string()
      .min(20, "Description must be at least 20 characters.")
      .max(10000)
      .describe("Full task description, including deliverables."),
    rewardUsdc: z
      .number()
      .positive("Reward must be greater than 0.")
      .describe("Gross reward in whole USDC units that will be escrowed."),
    durationHours: z
      .number()
      .positive("Duration must be greater than 0.")
      .describe("How long the task stays open, in hours."),
    mode: z
      .enum(["bounty", "claim", "pitch", "benchmark", "auction"])
      .optional()
      .describe("Task mode. Defaults to bounty."),
    tags: z.string().optional().describe("Optional comma-separated tags."),
    deliverables: z
      .string()
      .min(1)
      .describe("Human-readable deliverable summary shown to the user before spend."),
  })
  .describe("Input schema for previewing a Taskmarket create-task request");

/**
 * Input schema for creating a Taskmarket task after explicit authorization.
 */
export const CreateTaskmarketTaskSchema = z
  .object({
    description: z.string().min(20).max(10000).describe("Exact description from the preview."),
    rewardUsdc: z.number().positive().describe("Exact reward from the preview, in whole USDC."),
    durationHours: z.number().positive().describe("Exact duration from the preview, in hours."),
    mode: z.enum(["bounty", "claim", "pitch", "benchmark", "auction"]).optional(),
    tags: z.string().optional(),
    deliverables: z.string().min(1),
    confirmationToken: z
      .string()
      .min(16)
      .describe("Token returned by preview_taskmarket_task for this exact payload."),
    iAuthorizeSpend: z
      .boolean()
      .describe(
        "Must be true. Fresh, explicit user authorization to escrow rewardUsdc USDC on Base.",
      ),
  })
  .describe("Input schema for creating a Taskmarket task after preview + user authorization");

/**
 * Input schema for listing submissions for human review.
 */
export const ListTaskmarketSubmissionsSchema = z
  .object({
    taskId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "taskId must be a 0x-prefixed 32-byte hex id")
      .describe("Taskmarket task id"),
  })
  .describe("Input schema for listing Taskmarket submissions for human review");
