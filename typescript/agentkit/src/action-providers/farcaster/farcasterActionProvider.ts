import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { FarcasterAccountDetailsSchema, FarcasterPostCastSchema } from "./schemas";

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
        }),
      });
      const data = await response.json();
      return `Successfully posted cast to Farcaster:\n${JSON.stringify(data)}`;
    } catch (error) {
      return `Error posting to Farcaster:\n${error}`;
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
