import { z } from "zod";

/**
 * Input schema for listing Taskmarket tasks
 */
export const ListTasksSchema = z
  .object({
    status: z.string().describe("Task status filter, e.g. open").default("open"),
    limit: z.number().int().min(1).max(100).describe("Maximum number of results").default(20),
    rewardMin: z
      .number()
      .nullable()
      .optional()
      .describe("Optional minimum reward in USDC"),
    tags: z.string().nullable().optional().describe("Optional comma-separated tag filter"),
  })
  .strict();

/**
 * Input schema for getting a single Taskmarket task
 */
export const GetTaskSchema = z
  .object({
    taskId: z.string().describe("The 0x-prefixed Taskmarket task id"),
  })
  .strict();

/**
 * Input schema for listing the wallet's own submissions
 */
export const GetMySubmissionsSchema = z.object({}).strict();

/**
 * Input schema for submitting work to a Taskmarket task
 */
export const SubmitWorkSchema = z
  .object({
    taskId: z.string().describe("The 0x-prefixed Taskmarket task id"),
    filePath: z.string().describe("Local path of the deliverable file to submit"),
    role: z
      .enum(["preview", "source", "final", "attachment"])
      .describe("Artifact role applied to the submitted file")
      .default("final"),
    confirm: z
      .boolean()
      .describe("Must be true to submit; submission is irreversible and anchors the artifact on-chain")
      .default(false),
  })
  .strict();

/**
 * Input schema for creating a Taskmarket task
 */
export const CreateTaskSchema = z
  .object({
    description: z.string().describe("Full task specification shown to workers"),
    rewardUsdc: z.number().positive().describe("Reward in USDC; this amount is escrowed"),
    durationHours: z.number().int().positive().describe("Hours until the task expires"),
    tags: z.string().nullable().optional().describe("Optional comma-separated tags"),
    confirm: z
      .boolean()
      .describe("Must be true to create the task and escrow the reward")
      .default(false),
  })
  .strict();
