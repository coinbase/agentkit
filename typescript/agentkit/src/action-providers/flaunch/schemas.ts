import { z } from "zod";

/**
 * Action schemas for the flaunch action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the flaunch action provider.
 */

/**
 * Schema for Flaunch token creation
 */
export const FlaunchSchema = z.object({
  /**
   * Name of the token
   */
  name: z.string().min(1).describe("The name of the token"),

  /**
   * Symbol of the token
   */
  symbol: z.string().min(1).describe("The symbol of the token"),

  /**
   * URL to the token image
   */
  imageUrl: z.string().url().describe("The URL to the token image"),

  /**
   * Description of the token
   */
  description: z.string().describe("The description of the token"),

  /**
   * Optional website URL
   */
  websiteUrl: z.string().url().optional().describe("The (optional) URL to the token website"),

  /**
   * Optional Discord URL
   */
  discordUrl: z.string().url().optional().describe("The (optional) URL to the token Discord"),

  /**
   * Optional Twitter URL
   */
  twitterUrl: z.string().url().optional().describe("The (optional) URL to the token Twitter"),

  /**
   * Optional Telegram URL
   */
  telegramUrl: z.string().url().optional().describe("The (optional) URL to the token Telegram"),
});
