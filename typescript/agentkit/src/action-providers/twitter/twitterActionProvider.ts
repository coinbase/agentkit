import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { TwitterApi, TwitterApiTokens } from "twitter-api-v2";
import { Network } from "../../network";
import {
  TwitterAccountDetailsSchema,
  TwitterAccountMentionsSchema,
  TwitterPostTweetSchema,
  TwitterPostTweetReplySchema,
  TwitterUploadMediaSchema,
} from "./schemas";

/**
 * Configuration options for the TwitterActionProvider.
 */
export interface TwitterActionProviderConfig {
  /**
   * Twitter API Key
   */
  apiKey?: string;

  /**
   * Twitter API Secret
   */
  apiSecret?: string;

  /**
   * Twitter Access Token
   */
  accessToken?: string;

  /**
   * Twitter Access Token Secret
   */
  accessTokenSecret?: string;
}

/**
 * TwitterActionProvider is an action provider for Twitter (X) interactions.
 *
 * @augments ActionProvider
 */
export class TwitterActionProvider extends ActionProvider {
  private client: TwitterApi | null = null;
  private config: TwitterActionProviderConfig;

  /**
   * Constructor for the TwitterActionProvider class.
   *
   * @param config - The configuration options for the TwitterActionProvider
   */
  constructor(config: TwitterActionProviderConfig = {}) {
    super("twitter", []);

    // Store config for later use but don't initialize the client yet
    this.config = { ...config };

    // Set defaults from environment variables
    this.config.apiKey ||= process.env.TWITTER_API_KEY;
    this.config.apiSecret ||= process.env.TWITTER_API_SECRET;
    this.config.accessToken ||= process.env.TWITTER_ACCESS_TOKEN;
    this.config.accessTokenSecret ||= process.env.TWITTER_ACCESS_TOKEN_SECRET;

    // Validate config
    if (!this.config.apiKey) {
      throw new Error("TWITTER_API_KEY is not configured.");
    }
    if (!this.config.apiSecret) {
      throw new Error("TWITTER_API_SECRET is not configured.");
    }
    if (!this.config.accessToken) {
      throw new Error("TWITTER_ACCESS_TOKEN is not configured.");
    }
    if (!this.config.accessTokenSecret) {
      throw new Error("TWITTER_ACCESS_TOKEN_SECRET is not configured.");
    }
  }

  /**
   * Get account details for the currently authenticated Twitter (X) user.
   *
   * @param _ - Empty parameter object (not used)
   * @returns A JSON string containing the account details or error message
   */
  @CreateAction({
    name: "account_details",
    description: `
This tool will return account details for the currently authenticated Twitter (X) user context.

A successful response will return a message with the api response as a json payload:
    {"data": {"id": "1853889445319331840", "name": "CDP AgentKit", "username": "CDPAgentKit"}}

A failure response will return a message with a Twitter API request error:
    Error retrieving authenticated user account: 429 Too Many Requests`,
    schema: TwitterAccountDetailsSchema,
  })
  async accountDetails(_: z.infer<typeof TwitterAccountDetailsSchema>): Promise<string> {
    try {
      const response = await this.getClient().v2.me();
      response.data.url = `https://x.com/${response.data.username}`;
      return `Successfully retrieved authenticated user account details:\n${JSON.stringify(
        response,
      )}`;
    } catch (error) {
      return `Error retrieving authenticated user account details: ${error}`;
    }
  }

  /**
   * Get mentions for a specified Twitter (X) user.
   *
   * @param args - The arguments containing userId
   * @returns A JSON string containing the mentions or error message
   */
  @CreateAction({
    name: "account_mentions",
    description: `
This tool will return mentions for the specified Twitter (X) user id.

A successful response will return a message with the API response as a JSON payload:
    {"data": [{"id": "1857479287504584856", "text": "@CDPAgentKit reply"}]}

A failure response will return a message with the Twitter API request error:
    Error retrieving user mentions: 429 Too Many Requests`,
    schema: TwitterAccountMentionsSchema,
  })
  async accountMentions(args: z.infer<typeof TwitterAccountMentionsSchema>): Promise<string> {
    try {
      const response = await this.getClient().v2.userMentionTimeline(args.userId);
      return `Successfully retrieved account mentions:\n${JSON.stringify(response)}`;
    } catch (error) {
      return `Error retrieving authenticated account mentions: ${error}`;
    }
  }

  /**
   * Post a tweet on Twitter (X).
   *
   * @param args - The arguments containing the tweet text
   * @returns A JSON string containing the posted tweet details or error message
   */
  @CreateAction({
    name: "post_tweet",
    description: `
This tool will post a tweet on Twitter. The tool takes the text of the tweet as input. Tweets can be maximum 280 characters.
Optionally, up to 4 media items (images, videos) can be attached to the tweet by providing their media IDs in the mediaIds array.
Media IDs are obtained by first uploading the media using the upload_media action.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"text": "hello, world!", "id": "0123456789012345678", "edit_history_tweet_ids": ["0123456789012345678"]}}

A failure response will return a message with the Twitter API request error:
    You are not allowed to create a Tweet with duplicate content.`,
    schema: TwitterPostTweetSchema,
  })
  async postTweet(args: z.infer<typeof TwitterPostTweetSchema>): Promise<string> {
    try {
      let mediaOptions = {};

      if (args.mediaIds && args.mediaIds.length > 0) {
        // Convert array to tuple format expected by the Twitter API
        const mediaIdsTuple = args.mediaIds as unknown as [string, ...string[]];
        mediaOptions = {
          media: { media_ids: mediaIdsTuple },
        };
      }

      const response = await this.getClient().v2.tweet(args.tweet, mediaOptions);
      return `Successfully posted to Twitter:\n${JSON.stringify(response)}`;
    } catch (error) {
      return `Error posting to Twitter:\n${error} with media ids: ${args.mediaIds}`;
    }
  }

  /**
   * Post a reply to a tweet on Twitter (X).
   *
   * @param args - The arguments containing the reply text and tweet ID
   * @returns A JSON string containing the posted reply details or error message
   */
  @CreateAction({
    name: "post_tweet_reply",
    description: `
This tool will post a reply to a tweet on Twitter. The tool takes the text of the reply and the ID of the tweet to reply to as input.
Replies can be maximum 280 characters.
Optionally, up to 4 media items (images, videos) can be attached to the reply by providing their media IDs in the mediaIds array.
Media IDs can be obtained by first uploading the media using the upload_media action.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"text": "hello, world!", "id": "0123456789012345678", "edit_history_tweet_ids": ["0123456789012345678"]}}

A failure response will return a message with the Twitter API request error:
    You are not allowed to create a Tweet with duplicate content.`,
    schema: TwitterPostTweetReplySchema,
  })
  async postTweetReply(args: z.infer<typeof TwitterPostTweetReplySchema>): Promise<string> {
    try {
      const options: Record<string, unknown> = {
        reply: { in_reply_to_tweet_id: args.tweetId },
      };

      if (args.mediaIds && args.mediaIds.length > 0) {
        // Convert array to tuple format expected by the Twitter API
        const mediaIdsTuple = args.mediaIds as unknown as [string, ...string[]];
        options.media = { media_ids: mediaIdsTuple };
      }

      const response = await this.getClient().v2.tweet(args.tweetReply, options);

      return `Successfully posted reply to Twitter:\n${JSON.stringify(response)}`;
    } catch (error) {
      return `Error posting reply to Twitter: ${error}`;
    }
  }

  /**
   * Upload media to Twitter.
   *
   * @param args - The arguments containing the file path
   * @returns A JSON string containing the media ID or error message
   */
  @CreateAction({
    name: "upload_media",
    description: `
This tool will upload media (images, videos, etc.) to Twitter.

A successful response will return a message with the media ID:
    Successfully uploaded media to Twitter: 1234567890

A failure response will return a message with the Twitter API request error:
    Error uploading media to Twitter: Invalid file format`,
    schema: TwitterUploadMediaSchema,
  })
  async uploadMedia(args: z.infer<typeof TwitterUploadMediaSchema>): Promise<string> {
    try {
      const mediaId = await this.getClient().v1.uploadMedia(args.filePath);
      return `Successfully uploaded media to Twitter: ${mediaId}`;
    } catch (error) {
      return `Error uploading media to Twitter: ${error}`;
    }
  }

  /**
   * Checks if the Twitter action provider supports the given network.
   * Twitter actions don't depend on blockchain networks, so always return true.
   *
   * @param _ - The network to check (not used)
   * @returns Always returns true as Twitter actions are network-independent
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Get the Twitter API client, initializing it if needed
   *
   * @returns The Twitter API client
   */
  private getClient(): TwitterApi {
    if (!this.client) {
      // Initialize client only when needed
      const tokens: TwitterApiTokens = {
        appKey: this.config.apiKey!,
        appSecret: this.config.apiSecret!,
        accessToken: this.config.accessToken!,
        accessSecret: this.config.accessTokenSecret!,
      };
      this.client = new TwitterApi(tokens);
    }
    return this.client;
  }
}

/**
 * Factory function to create a new TwitterActionProvider instance.
 *
 * @param config - The configuration options for the TwitterActionProvider
 * @returns A new instance of TwitterActionProvider
 */
export const twitterActionProvider = (config: TwitterActionProviderConfig = {}) =>
  new TwitterActionProvider(config);
