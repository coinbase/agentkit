import { z } from "zod";

/**
 * Input schema for getting Discord channel details.
 */
export const DiscordGetChannelSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel"),
  })
  .strip()
  .describe("Instructions for getting Discord channel details");

/**
 * Input schema for sending a Discord message.
 */
export const DiscordSendMessageSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel to send message to"),
    content: z
      .string()
      .max(2000)
      .describe("The content of the message (max 2000 characters)"),
    embeds: z
      .array(
        z.object({
          title: z.string().optional().describe("Embed title"),
          description: z.string().optional().describe("Embed description"),
          color: z.number().optional().describe("Embed color (decimal color code)"),
          url: z.string().optional().describe("Embed URL"),
          timestamp: z.string().optional().describe("Embed timestamp (ISO 8601)"),
          footer: z
            .object({
              text: z.string().describe("Footer text"),
              icon_url: z.string().optional().describe("Footer icon URL"),
            })
            .optional()
            .describe("Embed footer"),
          image: z
            .object({
              url: z.string().describe("Image URL"),
            })
            .optional()
            .describe("Embed image"),
          thumbnail: z
            .object({
              url: z.string().describe("Thumbnail URL"),
            })
            .optional()
            .describe("Embed thumbnail"),
          fields: z
            .array(
              z.object({
                name: z.string().describe("Field name"),
                value: z.string().describe("Field value"),
                inline: z.boolean().optional().describe("Whether field is inline"),
              }),
            )
            .optional()
            .describe("Embed fields"),
        }),
      )
      .max(10)
      .optional()
      .describe("Array of embeds (max 10)"),
  })
  .strip()
  .describe("Instructions for sending a Discord message");

/**
 * Input schema for replying to a Discord message.
 */
export const DiscordReplyToMessageSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel"),
    messageId: z.string().describe("The ID of the message to reply to"),
    content: z
      .string()
      .max(2000)
      .describe("The content of the reply (max 2000 characters)"),
  })
  .strip()
  .describe("Instructions for replying to a Discord message");

/**
 * Input schema for getting Discord messages from a channel.
 */
export const DiscordGetMessagesSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(50)
      .describe("Number of messages to retrieve (1-100, default 50)"),
  })
  .strip()
  .describe("Instructions for getting messages from a Discord channel");

/**
 * Input schema for creating a Discord thread.
 */
export const DiscordCreateThreadSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel to create thread in"),
    name: z.string().max(100).describe("The name of the thread (max 100 characters)"),
    message: z.string().optional().describe("Initial message for the thread"),
    autoArchiveDuration: z
      .number()
      .optional()
      .describe("Thread auto-archive duration in minutes (60, 1440, 4320, 10080)"),
  })
  .strip()
  .describe("Instructions for creating a Discord thread");

/**
 * Input schema for adding a reaction to a message.
 */
export const DiscordAddReactionSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel"),
    messageId: z.string().describe("The ID of the message to react to"),
    emoji: z.string().describe("The emoji to react with (Unicode emoji or custom emoji ID)"),
  })
  .strip()
  .describe("Instructions for adding a reaction to a Discord message");

/**
 * Input schema for getting Discord guild (server) details.
 */
export const DiscordGetGuildSchema = z
  .object({
    guildId: z.string().describe("The ID of the Discord guild (server)"),
  })
  .strip()
  .describe("Instructions for getting Discord guild details");

/**
 * Input schema for getting bot user details.
 */
export const DiscordGetBotUserSchema = z
  .object({})
  .strip()
  .describe("Instructions for getting Discord bot user details");

/**
 * Input schema for editing a Discord message.
 */
export const DiscordEditMessageSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel"),
    messageId: z.string().describe("The ID of the message to edit"),
    content: z
      .string()
      .max(2000)
      .describe("The new content of the message (max 2000 characters)"),
  })
  .strip()
  .describe("Instructions for editing a Discord message");

/**
 * Input schema for deleting a Discord message.
 */
export const DiscordDeleteMessageSchema = z
  .object({
    channelId: z.string().describe("The ID of the Discord channel"),
    messageId: z.string().describe("The ID of the message to delete"),
  })
  .strip()
  .describe("Instructions for deleting a Discord message");