import { z } from "zod";

/**
 * List open TaskMarket tasks.
 */
export const ListOpenTasksSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .nullable()
      .describe("Max tasks to return (1-50). Defaults to 10."),
    mode: z
      .string()
      .nullable()
      .describe("Optional mode filter: bounty, claim, pitch, benchmark, auction"),
    tags: z
      .string()
      .nullable()
      .describe("Optional comma-separated tags filter"),
  })
  .strict();

/**
 * Fetch a single task by id.
 */
export const GetTaskSchema = z
  .object({
    taskId: z
      .string()
      .describe("TaskMarket task id (0x… hex) or full task URL"),
  })
  .strict();

/**
 * Draft a delegation proposal — does NOT create or fund a task.
 */
export const PrepareDelegationSchema = z
  .object({
    description: z.string().describe("Concrete deliverable description for the task"),
    rewardUsdc: z
      .number()
      .positive()
      .describe("Proposed escrow reward in USDC (human-readable, e.g. 5)"),
    durationHours: z
      .number()
      .positive()
      .describe("Proposed task duration in hours"),
    mode: z
      .string()
      .nullable()
      .describe("Task mode (default bounty)"),
    spendingLimitUsdc: z
      .number()
      .positive()
      .describe("Hard spending ceiling the user must approve before any create/fund call"),
    userAuthorized: z
      .boolean()
      .describe(
        "Must be true only after the human explicitly approved this draft. False = draft only.",
      ),
  })
  .strict();

/**
 * Submit work to an existing task. Requires explicit user authorization.
 * Does not create tasks or move funds.
 */
export const SubmitWorkSchema = z
  .object({
    taskId: z.string().describe("Target task id (0x…)"),
    deliverableSummary: z
      .string()
      .describe("Short summary of the deliverable being submitted"),
    artifactPaths: z
      .array(z.string())
      .nullable()
      .describe("Optional local file paths / URLs for evidence artifacts"),
    userAuthorized: z
      .boolean()
      .describe(
        "REQUIRED true: human must have authorized this submission. Silent submit is forbidden.",
      ),
  })
  .strict();
