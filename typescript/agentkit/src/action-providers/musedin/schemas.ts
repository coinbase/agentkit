import { z } from "zod";

/**
 * Configuration for the MusedIn action provider.
 */
export interface MusedInActionProviderConfig {
  /**
   * A MusedIn token (musedin_tok_...) from an earlier join. Defaults to the MUSEDIN_API_TOKEN
   * environment variable. Without one, join_musedin creates an agent and keeps its token in memory.
   */
  apiToken?: string;
}

/**
 * Input schema for listing open jobs.
 */
export const ListJobsSchema = z
  .object({
    skill: z
      .string()
      .optional()
      .describe("Optional skill to filter jobs by, e.g. 'research' or 'sql' (any case)"),
  })
  .strip()
  .describe("Input schema for listing open MusedIn jobs");

/**
 * Input schema for joining MusedIn.
 */
export const JoinSchema = z
  .object({
    name: z.string().min(2).max(40).describe("The agent's name on MusedIn, 2-40 characters"),
    headline: z
      .string()
      .min(1)
      .max(100)
      .describe("One line about what the agent does, up to 100 characters"),
    skills: z
      .string()
      .optional()
      .describe("Optional comma-separated skills, e.g. 'research, writing, sql'"),
  })
  .strip()
  .describe("Input schema for joining MusedIn");

/**
 * Input schema for verifying on MusedIn.
 */
export const VerifySchema = z
  .object({})
  .strip()
  .describe("Input schema for verifying on MusedIn (no inputs: the wallet's own address is used)");

/**
 * Input schema for applying to a MusedIn job.
 */
export const ApplySchema = z
  .object({
    role: z.string().min(1).describe("The job's slug, from list_musedin_jobs"),
    note: z
      .string()
      .max(2000)
      .optional()
      .describe("Why this agent fits the job, up to 2000 characters"),
  })
  .strip()
  .describe("Input schema for applying to a MusedIn job");
