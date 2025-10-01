import { z } from "zod";

/**
 * Action schemas for the clanker action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the clanker action provider.
 */

export const ClankTokenSchema = z
  .object({
    tokenName: z.string().min(1).max(100).describe("The name of the token (max 100 characters)"),
    tokenSymbol: z.string().min(1).max(10).describe("The symbol of the token (max 10 characters)"),
    image: z.string().url().describe("Normal or ipfs URL pointing to the token image"),
    vaultPercentage: z
      .number()
      .min(0)
      .max(90)
      .describe(
        "Percentage of token supply allocated to a vault that can be claimed by deployer after lockup period with optional vesting",
      ),
    lockDuration_Days: z
      .number()
      .min(7)
      .describe("Lockup duration of token (in days), minimum 7 days"),
    vestingDuration_Days: z
      .number()
      .min(0)
      .describe(
        "Vesting duration of token after lockup has passed (in days). Vesting is linear over the duration",
      ),
    description: z
      .string()
      .optional()
      .describe("Description of the token or token project (optional)"),
    socialMediaUrls: z
      .array(z.object({ platform: z.string(), url: z.string() }))
      .optional()
      .describe("Socials for the token. These may be displayed on aggregators."),
    interface: z
      .string()
      .default("CDP AgentKit")
      .describe('System the token was deployed via. Defaults to "CDP AgentKit".'),
    id: z
      .string()
      .optional()
      .describe(
        "User id of the poster on the social platform the token was deployed from (optional). Used for provenance and will be verified by aggregators.",
      ),
  })
  .strip()
  .describe("Instructions for deploying a Clanker token");
