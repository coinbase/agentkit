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

/** Inputs for creating and funding a new Base-mainnet TaskMarket bounty. */
export const TaskMarketCreateTaskSchema = z
  .object({
    description: z.string().trim().min(1).describe("Human-readable task description"),
    deliverables: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(20)
      .describe("Concrete deliverables the worker must provide"),
    rewardUsdc: z.number().positive().describe("Escrowed reward in USDC"),
    deadlineIso: z
      .string()
      .min(1)
      .refine(value => Number.isFinite(Date.parse(value)), "deadlineIso must be an ISO date"),
    network: z.literal("base-mainnet").describe("TaskMarket settlement network"),
    maxSpendUsdc: z.number().nonnegative().describe("Maximum USDC the caller authorizes"),
    confirmed: z
      .literal(true)
      .describe("Fresh explicit confirmation that the displayed task details may be funded"),
    tags: z.array(z.string().trim().min(1)).max(20).optional().describe("Task tags"),
  })
  .describe(
    "Create a TaskMarket bounty only after showing description, reward, deadline, deliverables, Base network, and maximum spend to the user",
  );

/** Input for retrieving submissions owned by the current EVM wallet. */
export const TaskMarketMySubmissionsSchema = z.object({
  taskId: taskId.optional().describe("Optionally restrict results to one task"),
});

/** Input for retrieving every submission to a requester-owned task. */
export const TaskMarketTaskSubmissionsSchema = z
  .object({ taskId })
  .describe("TaskMarket requester submission review request");

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
