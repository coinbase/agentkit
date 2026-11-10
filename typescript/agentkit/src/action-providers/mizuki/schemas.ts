import { z } from "zod";

/**
 * Input schema for quoting maintenance on a GitHub issue.
 */
export const QuoteMaintenanceSchema = z
  .object({
    githubIssueUrl: z.string().url().describe("URL of an open issue in a public GitHub repository"),
  })
  .strip()
  .describe("Instructions for quoting Mizuki maintenance on a GitHub issue");

/**
 * Input schema for reading the state of a maintenance job.
 */
export const GetJobStatusSchema = z
  .object({
    jobId: z.string().uuid().describe("Job identifier returned when the job was submitted"),
  })
  .strip()
  .describe("Instructions for reading the state of a Mizuki maintenance job");

/**
 * Input schema for assessing whether a repository qualifies for maintenance.
 */
export const AssessRepositorySchema = z
  .object({
    owner: z.string().describe("GitHub owner or organisation, such as `open-covenant`"),
    repo: z.string().describe("GitHub repository name, such as `covenant`"),
  })
  .strip()
  .describe("Instructions for assessing a repository against Mizuki's requirements");

/**
 * Input schema for listing open maintenance bounties.
 */
export const ListBountiesSchema = z
  .object({})
  .strip()
  .describe("Instructions for listing Mizuki's open public maintenance bounties");
