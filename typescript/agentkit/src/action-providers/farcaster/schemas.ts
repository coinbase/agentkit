import { z } from "zod";

/**
 * Input argument schema for the account_details action.
 */
export const FarcasterAccountDetailsSchema = z
  .object({})
  .describe("Input schema for retrieving account details");

/**
 * Input argument schema for the post cast action.
 */
export const FarcasterPostCastSchema = z
  .object({
    castText: z.string().max(280, "Cast text must be a maximum of 280 characters."),
    embeds: z
      .array(
        z.object({
          url: z.string().url("Embed URL must be a valid URL"),
        }),
      )
      .max(2, "Maximum of 2 embeds allowed")
      .nullable(),
  })
  .describe("Input schema for posting a text-based cast");

/**
 * Input argument schema for getting user details by username or FID.
 */
export const FarcasterGetUserDetailsSchema = z
  .object({
    username: z.string().optional().describe("The username of the Farcaster account to look up"),
    fid: z.number().optional().describe("The FID of the Farcaster account to look up"),
  })
  .refine((data) => data.username || data.fid, {
    message: "Either username or fid must be provided",
  })
  .describe("Input schema for getting user details by username or FID");

/**
 * Input argument schema for replying to a cast.
 */
export const FarcasterReplyCastSchema = z
  .object({
    parentHash: z.string().describe("The hash of the parent cast to reply to"),
    replyText: z.string().max(280, "Reply text must be a maximum of 280 characters."),
    embeds: z
      .array(
        z.object({
          url: z.string().url("Embed URL must be a valid URL"),
        }),
      )
      .max(2, "Maximum of 2 embeds allowed")
      .optional(),
  })
  .strip()
  .describe("Input schema for replying to a cast");

/**
 * Input argument schema for getting user's feed/casts.
 */
export const FarcasterGetFeedSchema = z
  .object({
    fid: z.number().optional().describe("The FID of the user to get casts for. Defaults to agent's FID if not provided."),
    limit: z.number().min(1).max(100).default(25).describe("Number of casts to retrieve (1-100, default: 25)"),
    includeReplies: z.boolean().default(false).describe("Whether to include replies in the feed"),
  })
  .strip()
  .describe("Input schema for getting a user's feed/casts");

/**
 * Input argument schema for getting mentions.
 */
export const FarcasterGetMentionsSchema = z
  .object({
    limit: z.number().min(1).max(100).default(25).describe("Number of mentions to retrieve (1-100, default: 25)"),
  })
  .strip()
  .describe("Input schema for getting mentions of the agent");
