import { z } from "zod";

/**
 * Input argument schema for the account_details action.
 */
export const FarcasterAccountDetailsSchema = z
  .object({})
  .strip()
  .describe("Input schema for retrieving account details");

/**
 * Input argument schema for the post cast action.
 */
export const FarcasterPostCastSchema = z
  .object({
    castText: z.string().max(280, "Cast text must be a maximum of 280 characters."),
  })
  .strip()
  .describe("Input schema for posting a text-based cast");
