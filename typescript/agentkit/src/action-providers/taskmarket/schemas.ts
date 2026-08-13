import { z } from "zod";

const taskId = z
  .string()
  .min(1)
  .describe("TaskMarket task identifier, usually a 0x-prefixed 32-byte hex value");

/** Filters accepted by the TaskMarket task search endpoint. */
export const TaskMarketListTasksSchema = z
  .object({
    status: z.string().optional().default("open").describe("Task status, for example open"),
    phase: z
      .enum(["active", "in_review", "awaiting_settlement", "resolved"])
      .optional()
      .describe("Derived lifecycle phase"),
    mode: z
      .enum(["bounty", "claim", "pitch", "benchmark", "auction"])
      .optional()
      .describe("Task mode"),
    tags: z.array(z.string()).optional().describe("Tags to match"),
    rewardMin: z.number().nonnegative().optional().describe("Minimum reward in USDC"),
    rewardMax: z.number().nonnegative().optional().describe("Maximum reward in USDC"),
    deadlineHours: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Only tasks expiring within this many hours"),
    limit: z.number().int().positive().max(100).optional().default(20),
    cursor: z.string().optional().describe("Pagination cursor returned by a previous call"),
  })
  .describe("Filters for searching public TaskMarket tasks");

/** Input for retrieving a single task. */
export const TaskMarketGetTaskSchema = z.object({ taskId }).describe("TaskMarket task lookup");

/** Input for claiming a task as the current EVM wallet. */
export const TaskMarketClaimTaskSchema = z.object({ taskId }).describe("TaskMarket claim request");

/** Input for retrieving submissions owned by the current EVM wallet. */
export const TaskMarketMySubmissionsSchema = z.object({
  taskId: taskId.optional().describe("Optionally restrict results to one task"),
});

/**
 * A single text artifact. Text is intentionally explicit so an agent does not upload
 * arbitrary local files without the caller's knowledge.
 */
export const TaskMarketSubmitTextSchema = z
  .object({
    taskId,
    fileName: z
      .string()
      .min(1)
      .regex(/^[^\\/]+$/, "fileName must not contain path separators")
      .describe("Public artifact filename"),
    content: z.string().min(1).describe("Text content to submit as the artifact"),
    mimeType: z.string().min(1).optional().default("text/plain"),
    role: z
      .enum(["preview", "source", "final", "attachment"])
      .optional()
      .default("final")
      .describe("TaskMarket artifact role"),
  })
  .describe("Submit one explicitly provided text artifact to TaskMarket");


