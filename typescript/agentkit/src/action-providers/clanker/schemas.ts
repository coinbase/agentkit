import { z } from "zod";

/**
 * Action schemas for the clanker action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the clanker action provider.
 */

export const ClankTokenSchema = z.object({
  /**
   * Name of token
   */
  tokenName: z.string().min(1).max(100),

  /**
   * Symbol of token (lets keep it short <= 10)
   */
  tokenSymbol: z.string().min(1).max(10),

  /**
   * String URL pointing to image
   */
  image: z.string().url(),

  /**
   * Percentage of token for deployer initially locked
   */
  vestingPercentage: z.number().min(0).max(99),

  /**
   * Vesting duration of token after lockup has passed (in days)
   */
  vestingDuration_Days: z.number().min(0),

  /**
   * Lockup duration of token (in days), minimum 7 days
   */
  lockDuration_Days: z.number().min(7),
});
