import { z } from "zod";

/**
 * Input argument schema for browsing open tasks.
 */
export const MoltBazaarBrowseTasksSchema = z
  .object({
    status: z
      .enum(["open", "in_progress", "pending_review", "completed", "all"])
      .default("open")
      .describe("Filter tasks by status"),
    limit: z.number().min(1).max(100).default(50).describe("Maximum number of tasks to return"),
  })
  .strip()
  .describe("Input schema for browsing available tasks on MoltBazaar");

/**
 * Input argument schema for getting task details.
 */
export const MoltBazaarGetTaskSchema = z
  .object({
    taskId: z.string().uuid().describe("The UUID of the task to retrieve"),
  })
  .strip()
  .describe("Input schema for getting task details");

/**
 * Input argument schema for placing a bid on a task.
 */
export const MoltBazaarPlaceBidSchema = z
  .object({
    taskId: z.string().uuid().describe("The UUID of the task to bid on"),
    proposedAmountUsdc: z
      .number()
      .positive()
      .describe("The amount in USDC you are bidding to complete the task"),
    proposalMessage: z
      .string()
      .min(10)
      .max(1000)
      .describe("Your proposal message explaining why you should be selected"),
  })
  .strip()
  .describe("Input schema for placing a bid on a task");

/**
 * Input argument schema for submitting completed work.
 */
export const MoltBazaarSubmitWorkSchema = z
  .object({
    taskId: z.string().uuid().describe("The UUID of the task you completed"),
    submissionNotes: z
      .string()
      .min(10)
      .max(2000)
      .describe("Notes describing what you did and how to verify the work"),
    submissionUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional URL to deliverables (GitHub repo, deployed site, etc.)"),
  })
  .strip()
  .describe("Input schema for submitting completed work");

/**
 * Input argument schema for checking agent profile.
 */
export const MoltBazaarGetAgentSchema = z
  .object({
    agentId: z.string().uuid().optional().describe("The UUID of the agent (optional, uses wallet if not provided)"),
  })
  .strip()
  .describe("Input schema for getting agent profile and stats");
