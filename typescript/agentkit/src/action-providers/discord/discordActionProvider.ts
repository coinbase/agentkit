import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  DiscordGetChannelSchema,
  DiscordSendMessageSchema,
  DiscordReplyToMessageSchema,
  DiscordGetMessagesSchema,
  DiscordCreateThreadSchema,
  DiscordAddReactionSchema,
  DiscordGetGuildSchema,
  DiscordGetBotUserSchema,
  DiscordEditMessageSchema,
  DiscordDeleteMessageSchema,
} from "./schemas";

/**
 * Configuration options for the DiscordActionProvider.
 */
export interface DiscordActionProviderConfig {
  /**
   * Discord Bot Token
   */
  botToken?: string;

  /**
   * Base API URL (defaults to Discord API v10)
   */
  apiBaseUrl?: string;
}

/**
 * DiscordActionProvider is an action provider for Discord bot interactions.
 *
 * @augments ActionProvider
 */
export class DiscordActionProvider extends ActionProvider {
  private config: DiscordActionProviderConfig;
  private readonly API_VERSION = "10";

  /**
   * Constructor for the DiscordActionProvider class.
   *
   * @param config - The configuration options for the DiscordActionProvider
   */
  constructor(config: DiscordActionProviderConfig = {}) {
    super("discord", []);

    this.config = { ...config };

    // Set defaults from environment variables
    this.config.botToken ||= process.env.DISCORD_BOT_TOKEN;
    this.config.apiBaseUrl ||= `https://discord.com/api/v${this.API_VERSION}`;

    // Validate config
    if (!this.config.botToken) {
      throw new Error("DISCORD_BOT_TOKEN is not configured.");
    }
  }

  /**
   * Make a request to the Discord API
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const url = `${this.config.apiBaseUrl}${endpoint}`;
      const headers = {
        Authorization: `Bot ${this.config.botToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // 处理 204 No Content
      if (response.status === 204) {
        return { success: true, data: null };
      }

      let data;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        // 使用类型断言或安全检查
        let errorMessage = response.statusText;
        if (data && typeof data === 'object' && 'message' in data) {
          errorMessage = String(data.message);
        } else if (data) {
          errorMessage = JSON.stringify(data);
        }

        return {
          success: false,
          error: `Discord API Error ${response.status}: ${errorMessage}`,
        };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get details about the bot user.
   *
   * @param _ - Empty parameter object
   * @returns A JSON string containing the bot user details or error message
   */
  @CreateAction({
    name: "get_bot_user",
    description: `
This tool will return details about the currently authenticated Discord bot user.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"id": "123456789", "username": "MyBot", "discriminator": "0000", "bot": true}}

A failure response will return a message with a Discord API error:
    Error retrieving bot user details: 401 Unauthorized`,
    schema: DiscordGetBotUserSchema,
  })
  async getBotUser(_: z.infer<typeof DiscordGetBotUserSchema>): Promise<string> {
    const result = await this.makeRequest("/users/@me");

    if (result.success) {
      return `Successfully retrieved bot user details:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error retrieving bot user details: ${result.error}`;
  }

  /**
   * Get details about a Discord channel.
   *
   * @param args - The arguments containing channelId
   * @returns A JSON string containing the channel details or error message
   */
  @CreateAction({
    name: "get_channel",
    description: `
This tool will return details about a Discord channel.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"id": "123456789", "name": "general", "type": 0}}

A failure response will return a message with a Discord API error:
    Error retrieving channel: 404 Not Found`,
    schema: DiscordGetChannelSchema,
  })
  async getChannel(args: z.infer<typeof DiscordGetChannelSchema>): Promise<string> {
    const result = await this.makeRequest(`/channels/${args.channelId}`);

    if (result.success) {
      return `Successfully retrieved channel details:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error retrieving channel: ${result.error}`;
  }

  /**
   * Send a message to a Discord channel.
   *
   * @param args - The arguments containing channelId and message content
   * @returns A JSON string containing the sent message details or error message
   */
  @CreateAction({
    name: "send_message",
    description: `
This tool will send a message to a Discord channel. The message can be up to 2000 characters.
Optionally, you can include embeds for rich formatting (up to 10 embeds).

A successful response will return a message with the API response as a JSON payload:
    {"data": {"id": "987654321", "content": "Hello, Discord!", "channel_id": "123456789"}}

A failure response will return a message with a Discord API error:
    Error sending message: 403 Missing Permissions`,
    schema: DiscordSendMessageSchema,
  })
  async sendMessage(args: z.infer<typeof DiscordSendMessageSchema>): Promise<string> {
    const body: any = { content: args.content };

    if (args.embeds && args.embeds.length > 0) {
      body.embeds = args.embeds;
    }

    const result = await this.makeRequest(`/channels/${args.channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (result.success) {
      return `Successfully sent message to Discord:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error sending message: ${result.error}`;
  }

  /**
   * Reply to a Discord message.
   *
   * @param args - The arguments containing channelId, messageId, and reply content
   * @returns A JSON string containing the reply details or error message
   */
  @CreateAction({
    name: "reply_to_message",
    description: `
This tool will reply to a specific message in a Discord channel.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"id": "987654321", "content": "Reply!", "message_reference": {"message_id": "123"}}}

A failure response will return a message with a Discord API error:
    Error replying to message: 404 Unknown Message`,
    schema: DiscordReplyToMessageSchema,
  })
  async replyToMessage(args: z.infer<typeof DiscordReplyToMessageSchema>): Promise<string> {
    const result = await this.makeRequest(`/channels/${args.channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: args.content,
        message_reference: {
          message_id: args.messageId,
        },
      }),
    });

    if (result.success) {
      return `Successfully replied to message:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error replying to message: ${result.error}`;
  }

  /**
   * Get messages from a Discord channel.
   *
   * @param args - The arguments containing channelId and optional limit
   * @returns A JSON string containing the messages or error message
   */
  @CreateAction({
    name: "get_messages",
    description: `
This tool will retrieve messages from a Discord channel. You can specify how many messages to retrieve (1-100).

A successful response will return a message with the API response as a JSON payload:
    {"data": [{"id": "123", "content": "Hello", "author": {"username": "User"}}]}

A failure response will return a message with a Discord API error:
    Error retrieving messages: 403 Missing Access`,
    schema: DiscordGetMessagesSchema,
  })
  async getMessages(args: z.infer<typeof DiscordGetMessagesSchema>): Promise<string> {
    const limit = args.limit || 50;
    const result = await this.makeRequest(`/channels/${args.channelId}/messages?limit=${limit}`);

    if (result.success) {
      return `Successfully retrieved messages:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error retrieving messages: ${result.error}`;
  }

  /**
   * Create a thread in a Discord channel.
   *
   * @param args - The arguments containing channelId, thread name, and optional message
   * @returns A JSON string containing the thread details or error message
   */
  @CreateAction({
    name: "create_thread",
    description: `
This tool will create a thread in a Discord channel.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"id": "123456789", "name": "My Thread", "type": 11}}

A failure response will return a message with a Discord API error:
    Error creating thread: 403 Missing Permissions`,
    schema: DiscordCreateThreadSchema,
  })
  async createThread(args: z.infer<typeof DiscordCreateThreadSchema>): Promise<string> {
    const body: any = {
      name: args.name,
      type: 11, // PUBLIC_THREAD
    };

    if (args.autoArchiveDuration) {
      body.auto_archive_duration = args.autoArchiveDuration;
    }

    if (args.message) {
      body.message = { content: args.message };
    }

    const result = await this.makeRequest(`/channels/${args.channelId}/threads`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (result.success) {
      return `Successfully created thread:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error creating thread: ${result.error}`;
  }

  /**
   * Add a reaction to a Discord message.
   *
   * @param args - The arguments containing channelId, messageId, and emoji
   * @returns A success or error message
   */
  @CreateAction({
    name: "add_reaction",
    description: `
This tool will add a reaction emoji to a Discord message.

A successful response will return:
    Successfully added reaction to message

A failure response will return a message with a Discord API error:
    Error adding reaction: 403 Missing Permissions`,
    schema: DiscordAddReactionSchema,
  })
  async addReaction(args: z.infer<typeof DiscordAddReactionSchema>): Promise<string> {
    // URL encode the emoji
    const encodedEmoji = encodeURIComponent(args.emoji);

    const result = await this.makeRequest(
      `/channels/${args.channelId}/messages/${args.messageId}/reactions/${encodedEmoji}/@me`,
      {
        method: "PUT",
      },
    );

    if (result.success) {
      return `Successfully added reaction to message`;
    }
    return `Error adding reaction: ${result.error}`;
  }

  /**
   * Get details about a Discord guild (server).
   *
   * @param args - The arguments containing guildId
   * @returns A JSON string containing the guild details or error message
   */
  @CreateAction({
    name: "get_guild",
    description: `
This tool will return details about a Discord guild (server).

A successful response will return a message with the API response as a JSON payload:
    {"data": {"id": "123456789", "name": "My Server", "owner_id": "987654321"}}

A failure response will return a message with a Discord API error:
    Error retrieving guild: 404 Unknown Guild`,
    schema: DiscordGetGuildSchema,
  })
  async getGuild(args: z.infer<typeof DiscordGetGuildSchema>): Promise<string> {
    const result = await this.makeRequest(`/guilds/${args.guildId}`);

    if (result.success) {
      return `Successfully retrieved guild details:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error retrieving guild: ${result.error}`;
  }

  /**
   * Edit a Discord message.
   *
   * @param args - The arguments containing channelId, messageId, and new content
   * @returns A JSON string containing the edited message details or error message
   */
  @CreateAction({
    name: "edit_message",
    description: `
This tool will edit a message that was previously sent by the bot.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"id": "123456789", "content": "Edited content", "edited_timestamp": "..."}}

A failure response will return a message with a Discord API error:
    Error editing message: 403 Cannot edit a message authored by another user`,
    schema: DiscordEditMessageSchema,
  })
  async editMessage(args: z.infer<typeof DiscordEditMessageSchema>): Promise<string> {
    const result = await this.makeRequest(
      `/channels/${args.channelId}/messages/${args.messageId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ content: args.content }),
      },
    );

    if (result.success) {
      return `Successfully edited message:\n${JSON.stringify(result.data, null, 2)}`;
    }
    return `Error editing message: ${result.error}`;
  }

  /**
   * Delete a Discord message.
   *
   * @param args - The arguments containing channelId and messageId
   * @returns A success or error message
   */
  @CreateAction({
    name: "delete_message",
    description: `
This tool will delete a message from a Discord channel.

A successful response will return:
    Successfully deleted message

A failure response will return a message with a Discord API error:
    Error deleting message: 404 Unknown Message`,
    schema: DiscordDeleteMessageSchema,
  })
  async deleteMessage(args: z.infer<typeof DiscordDeleteMessageSchema>): Promise<string> {
    const result = await this.makeRequest(
      `/channels/${args.channelId}/messages/${args.messageId}`,
      {
        method: "DELETE",
      },
    );

    if (result.success) {
      return `Successfully deleted message`;
    }
    return `Error deleting message: ${result.error}`;
  }

  /**
   * Checks if the Discord action provider supports the given network.
   * Discord actions don't depend on blockchain networks, so always return true.
   *
   * @param _ - The network to check (not used)
   * @returns Always returns true as Discord actions are network-independent
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }
}

/**
 * Factory function to create a new DiscordActionProvider instance.
 *
 * @param config - The configuration options for the DiscordActionProvider
 * @returns A new instance of DiscordActionProvider
 */
export const discordActionProvider = (config: DiscordActionProviderConfig = {}) =>
  new DiscordActionProvider(config);