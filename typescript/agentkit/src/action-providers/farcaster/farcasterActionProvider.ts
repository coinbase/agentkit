import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  FarcasterAccountDetailsSchema,
  FarcasterPostCastSchema,
  FarcasterGetUserDetailsSchema,
  FarcasterReplyCastSchema,
  FarcasterGetFeedSchema,
  FarcasterGetMentionsSchema,
} from "./schemas";

/**
 * Configuration options for the FarcasterActionProvider.
 */
export interface FarcasterActionProviderConfig {
  /**
   * Neynar API Key.
   */
  neynarApiKey?: string;

  /**
   * Neynar managed signer UUID.
   */
  signerUuid?: string;

  /**
   * Agent FID.
   */
  agentFid?: string;
}

/**
 * FarcasterActionProvider is an action provider for Farcaster.
 */
export class FarcasterActionProvider extends ActionProvider {
  private readonly neynarApiKey: string;
  private readonly signerUuid: string;
  private readonly agentFid: string;

  /**
   * Constructor for the FarcasterActionProvider class.
   *
   * @param config - The configuration options for the FarcasterActionProvider.
   */
  constructor(config: FarcasterActionProviderConfig = {}) {
    super("farcaster", []);

    const neynarApiKey = config.neynarApiKey || process.env.NEYNAR_API_KEY;
    const signerUuid = config.signerUuid || process.env.NEYNAR_MANAGER_SIGNER;
    const agentFid = config.agentFid || process.env.AGENT_FID;

    if (!neynarApiKey) {
      throw new Error("NEYNAR_API_KEY is not configured.");
    }
    if (!signerUuid) {
      throw new Error("NEYNAR_MANAGER_SIGNER is not configured.");
    }
    if (!agentFid) {
      throw new Error("AGENT_FID is not configured.");
    }

    this.neynarApiKey = neynarApiKey;
    this.signerUuid = signerUuid;
    this.agentFid = agentFid;
  }

  /**
   * Retrieves agent's Farcaster account details.
   *
   * @param _ - The input arguments for the action.
   * @returns A message containing account details for the agent's Farcaster account.
   */
  @CreateAction({
    name: "account_details",
    description: `
This tool will retrieve the account details for the agent's Farcaster account.
The tool takes the FID of the agent's account.

A successful response will return a message with the API response as a JSON payload:
    { "object": "user", "fid": 193," username": "derek", "display_name": "Derek", ... }

A failure response will return a message with the Farcaster API request error:
    Unable to retrieve account details.
`,
    schema: FarcasterAccountDetailsSchema,
  })
  async accountDetails(_: z.infer<typeof FarcasterAccountDetailsSchema>): Promise<string> {
    try {
      const headers: HeadersInit = {
        accept: "application/json",
        "x-api-key": this.neynarApiKey,
        "x-neynar-experimental": "true",
      };

      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${this.agentFid}`,
        {
          method: "GET",
          headers,
        },
      );
      const { users } = await response.json();
      return `Successfully retrieved Farcaster account details:\n${JSON.stringify(users[0])}`;
    } catch (error) {
      return `Error retrieving Farcaster account details:\n${error}`;
    }
  }

  /**
   * Posts a cast on Farcaster.
   *
   * @param args - The input arguments for the action.
   * @returns A message indicating the success or failure of the cast posting.
   */
  @CreateAction({
    name: "post_cast",
    description: `
This tool will post a cast to Farcaster. The tool takes the text of the cast as input. Casts can be maximum 280 characters.
Optionally, up to 2 embeds (links to websites or mini apps) can be attached to the cast by providing an array of URLs in the embeds parameter.

A successful response will return a message with the API response as a JSON payload:
    {}

A failure response will return a message with the Farcaster API request error:
    You are not allowed to post a cast with duplicate content.
`,
    schema: FarcasterPostCastSchema,
  })
  async postCast(args: z.infer<typeof FarcasterPostCastSchema>): Promise<string> {
    try {
      const headers: HeadersInit = {
        api_key: this.neynarApiKey,
        "Content-Type": "application/json",
      };

      const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
        method: "POST",
        headers,
        body: JSON.stringify({
          signer_uuid: this.signerUuid,
          text: args.castText,
          embeds: args.embeds,
        }),
      });
      const data = await response.json();
      return `Successfully posted cast to Farcaster:\n${JSON.stringify(data)}`;
    } catch (error) {
      return `Error posting to Farcaster:\n${error}`;
    }
  }

  /**
   * Gets details for any Farcaster user by username or FID.
   *
   * @param args - The input arguments containing username or FID.
   * @returns A message containing the user's Farcaster account details.
   */
  @CreateAction({
    name: "get_user_details",
    description: `
This tool will retrieve the account details for any Farcaster user by their username or FID.
You must provide either a username or FID to look up.

A successful response will return a message with the API response as a JSON payload:
    { "object": "user", "fid": 193, "username": "derek", "display_name": "Derek", ... }

A failure response will return a message with the error:
    Unable to retrieve user details for the specified user.
`,
    schema: FarcasterGetUserDetailsSchema,
  })
  async getUserDetails(args: z.infer<typeof FarcasterGetUserDetailsSchema>): Promise<string> {
    try {
      const headers: HeadersInit = {
        accept: "application/json",
        "x-api-key": this.neynarApiKey,
        "x-neynar-experimental": "true",
      };

      let url: string;
      if (args.fid) {
        url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${args.fid}`;
      } else if (args.username) {
        url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${args.username}`;
      } else {
        return "Error: Either username or fid must be provided";
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      const data = await response.json();
      const user = args.fid ? data.users?.[0] : data.user;

      if (!user) {
        return `User not found for ${args.fid ? `FID: ${args.fid}` : `username: ${args.username}`}`;
      }

      return `Successfully retrieved Farcaster user details:\n${JSON.stringify(user)}`;
    } catch (error) {
      return `Error retrieving Farcaster user details:\n${error}`;
    }
  }

  /**
   * Replies to a cast on Farcaster.
   *
   * @param args - The input arguments for the reply action.
   * @returns A message indicating the success or failure of the reply.
   */
  @CreateAction({
    name: "reply_to_cast",
    description: `
This tool will post a reply to an existing cast on Farcaster.
The tool takes the parent cast hash and the reply text as input. Replies can be maximum 280 characters.
Optionally, up to 2 embeds (links to websites or mini apps) can be attached.

A successful response will return a message with the API response as a JSON payload:
    { "cast": { "hash": "...", "text": "..." } }

A failure response will return a message with the Farcaster API request error.
`,
    schema: FarcasterReplyCastSchema,
  })
  async replyToCast(args: z.infer<typeof FarcasterReplyCastSchema>): Promise<string> {
    try {
      const headers: HeadersInit = {
        api_key: this.neynarApiKey,
        "Content-Type": "application/json",
      };

      const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
        method: "POST",
        headers,
        body: JSON.stringify({
          signer_uuid: this.signerUuid,
          text: args.replyText,
          parent: args.parentHash,
          embeds: args.embeds,
        }),
      });

      const data = await response.json();
      return `Successfully posted reply to Farcaster:\n${JSON.stringify(data)}`;
    } catch (error) {
      return `Error posting reply to Farcaster:\n${error}`;
    }
  }

  /**
   * Gets a user's feed/casts from Farcaster.
   *
   * @param args - The input arguments for getting the feed.
   * @returns A message containing the user's casts.
   */
  @CreateAction({
    name: "get_feed",
    description: `
This tool will retrieve casts from a user's Farcaster feed.
If no FID is provided, it will retrieve the agent's own casts.
You can specify the number of casts to retrieve (1-100, default: 25) and whether to include replies.

A successful response will return a message with the casts as a JSON array:
    { "casts": [{ "hash": "...", "text": "...", "timestamp": "..." }, ...] }

A failure response will return a message with the error.
`,
    schema: FarcasterGetFeedSchema,
  })
  async getFeed(args: z.infer<typeof FarcasterGetFeedSchema>): Promise<string> {
    try {
      const headers: HeadersInit = {
        accept: "application/json",
        "x-api-key": this.neynarApiKey,
        "x-neynar-experimental": "true",
      };

      const fid = args.fid || this.agentFid;
      const limit = args.limit || 25;
      const includeReplies = args.includeReplies || false;

      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=${limit}&include_replies=${includeReplies}`,
        {
          method: "GET",
          headers,
        },
      );

      const data = await response.json();
      return `Successfully retrieved Farcaster feed (${data.casts?.length || 0} casts):\n${JSON.stringify(data.casts)}`;
    } catch (error) {
      return `Error retrieving Farcaster feed:\n${error}`;
    }
  }

  /**
   * Gets mentions of the agent on Farcaster.
   *
   * @param args - The input arguments for getting mentions.
   * @returns A message containing the mentions.
   */
  @CreateAction({
    name: "get_mentions",
    description: `
This tool will retrieve casts that mention the agent on Farcaster.
This is useful for the agent to respond to users who have mentioned them.
You can specify the number of mentions to retrieve (1-100, default: 25).

A successful response will return a message with the mentions as a JSON array:
    { "notifications": [{ "cast": { "hash": "...", "text": "...", "author": {...} }, ... }] }

A failure response will return a message with the error.
`,
    schema: FarcasterGetMentionsSchema,
  })
  async getMentions(args: z.infer<typeof FarcasterGetMentionsSchema>): Promise<string> {
    try {
      const headers: HeadersInit = {
        accept: "application/json",
        "x-api-key": this.neynarApiKey,
        "x-neynar-experimental": "true",
      };

      const limit = args.limit || 25;

      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/notifications?fid=${this.agentFid}&type=mentions&limit=${limit}`,
        {
          method: "GET",
          headers,
        },
      );

      const data = await response.json();
      return `Successfully retrieved Farcaster mentions (${data.notifications?.length || 0} mentions):\n${JSON.stringify(data.notifications)}`;
    } catch (error) {
      return `Error retrieving Farcaster mentions:\n${error}`;
    }
  }

  /**
   * Checks if the Farcaster action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Farcaster action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const farcasterActionProvider = (config: FarcasterActionProviderConfig = {}) =>
  new FarcasterActionProvider(config);
