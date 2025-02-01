import { z } from "zod";

/**
 * Input schema for retrieving account details.
 */
export const TwitterAccountDetailsSchema = z
  .object({})
  .strip()
  .describe("Input schema for retrieving account details");

/**
 * Input schema for retrieving account mentions.
 */
export const TwitterAccountMentionsSchema = z
  .object({
    userId: z
      .string()
      .min(1, "Account ID is required.")
      .describe("The Twitter (X) user id to return mentions for"),
  })
  .strip()
  .describe("Input schema for retrieving account mentions");

/**
 * Input schema for posting a tweet.
 */
export const TwitterPostTweetSchema = z
  .object({
    tweet: z.string().max(280, "Tweet must be a maximum of 280 characters."),
  })
  .strip()
  .describe("Input schema for posting a tweet");

/**
 * Input schema for posting a tweet reply.
 */
export const TwitterPostTweetReplySchema = z
  .object({
    tweetId: z.string().describe("The id of the tweet to reply to"),
    tweetReply: z
      .string()
      .max(280, "The reply to the tweet which must be a maximum of 280 characters."),
  })
  .strip()
  .describe("Input schema for posting a tweet reply");
