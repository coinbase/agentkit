import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  GiveFeedbackSchema,
  RevokeFeedbackSchema,
  AppendResponseSchema,
  GetAgentFeedbackSchema,
} from "./reputationSchemas";
import { getChainIdFromNetwork, isNetworkSupported } from "./constants";
import { getAgent0SDK } from "./utils";

/**
 * Configuration options for the ERC8004 Reputation Action Provider
 */
export interface ERC8004ReputationActionProviderConfig {
  pinataJwt?: string;
}

/**
 * ERC8004ReputationActionProvider provides actions for the ERC-8004 Reputation Registry.
 * This includes giving feedback, revoking feedback, responding to feedback, and querying reputation.
 */
export class ERC8004ReputationActionProvider extends ActionProvider<EvmWalletProvider> {
  private pinataJwt?: string;

  /**
   * Constructor for the ERC8004ReputationActionProvider.
   *
   * @param config - Optional configuration including Pinata JWT for IPFS uploads
   */
  constructor(config?: ERC8004ReputationActionProviderConfig) {
    super("erc8004_reputation", []);
    this.pinataJwt = config?.pinataJwt;
  }

  /**
   * Gives feedback to an agent.
   * Core feedback data (value, tags, endpoint) is always stored onchain.
   * When IPFS is configured (PINATA_JWT), an optional comment is also stored off-chain.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param args - The feedback details
   * @returns A message confirming the feedback submission
   */
  @CreateAction({
    name: "give_feedback",
    description: `
Submits feedback for an agent on the ERC-8004 Reputation Registry.
The value + valueDecimals pair represents a signed fixed-point number.


Examples:
| tag1             | What it measures          | Human value | value | valueDecimals |
|------------------|---------------------------|-------------|-------|---------------|
| starred          | Quality rating (0-100)    | 87/100      | 87    | 0             |
| reachable        | Endpoint reachable (bool) | true        | 1     | 0             |
| uptime           | Endpoint uptime (%)       | 99.77%      | 9977  | 2             |
| successRate      | Success rate (%)          | 89%         | 89    | 0             |
| responseTime     | Response time (ms)        | 560ms       | 560   | 0             |
| revenues         | Cumulative revenues (USD) | $560        | 560   | 0             |
| tradingYield     | Yield (with tag2=period)  | -3.2%       | -32   | 1             |
`,
    schema: GiveFeedbackSchema,
  })
  async giveFeedback(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GiveFeedbackSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const clientAddress = walletProvider.getAddress();

      const fullAgentId = args.agentId.includes(":") ? args.agentId : `${chainId}:${args.agentId}`;

      const sdk = getAgent0SDK(walletProvider, this.pinataJwt);

      const isOwner = await sdk.isAgentOwner(fullAgentId, clientAddress);
      if (isOwner) {
        return "Error: You cannot give feedback to your own agent.";
      }

      const decimals = args.valueDecimals ?? 0;
      const humanValue =
        decimals > 0
          ? (args.value / Math.pow(10, decimals)).toFixed(decimals)
          : args.value.toString();

      const hasA2aFileFields =
        Boolean(args.a2aTaskId) ||
        Boolean(args.a2aContextId) ||
        Boolean(args.a2aSkills && args.a2aSkills.length > 0);
      const hasOffchainPayload = Boolean(args.comment) || hasA2aFileFields;

      let feedbackFile: Record<string, unknown> | undefined;
      if (this.pinataJwt && hasOffchainPayload) {
        feedbackFile = {};
        if (args.comment) feedbackFile.comment = args.comment;
        if (args.a2aTaskId) feedbackFile.a2aTaskId = args.a2aTaskId;
        if (args.a2aContextId) feedbackFile.a2aContextId = args.a2aContextId;
        if (args.a2aSkills?.length) feedbackFile.a2aSkills = args.a2aSkills;
      }

      const handle = await sdk.giveFeedback(
        fullAgentId,
        humanValue,
        args.tag1,
        args.tag2,
        args.endpoint,
        feedbackFile,
      );

      await handle.waitMined();

      const commentLine = args.comment
        ? this.pinataJwt
          ? `\nComment: ${args.comment}`
          : `\nComment: ${args.comment} (not persisted — configure PINATA_JWT for off-chain storage)`
        : "";

      const a2aPersistLine =
        hasA2aFileFields && !this.pinataJwt
          ? "\nA2A metadata (task/context/skills) was not persisted — configure PINATA_JWT for off-chain storage"
          : "";

      const a2aSubmittedLines: string[] = [];
      if (this.pinataJwt && hasA2aFileFields) {
        if (args.a2aTaskId) a2aSubmittedLines.push(`A2A task: ${args.a2aTaskId}`);
        if (args.a2aContextId) a2aSubmittedLines.push(`A2A context: ${args.a2aContextId}`);
        if (args.a2aSkills?.length)
          a2aSubmittedLines.push(`A2A skills: ${args.a2aSkills.join(", ")}`);
      }
      const a2aDetail = a2aSubmittedLines.length > 0 ? `\n${a2aSubmittedLines.join("\n")}` : "";

      const endpointLine = args.endpoint ? `\n Endpoint: ${args.endpoint}` : "";

      return `Feedback submitted successfully!\n\nAgent ID: ${args.agentId}\nValue: ${args.value}${decimals ? ` (${decimals} decimals)` : ""}\nTags: ${args.tag1 || "(none)"}${args.tag2 ? `, ${args.tag2}` : ""}${endpointLine}${commentLine}${a2aPersistLine}${a2aDetail}\n\nTransaction hash: ${handle.hash}`;
    } catch (error) {
      return `Error giving feedback: ${error}`;
    }
  }

  /**
   * Revokes previously submitted feedback.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param args - The agentId and feedbackIndex to revoke
   * @returns A message confirming the revocation
   */
  @CreateAction({
    name: "revoke_feedback",
    description: `
Revokes feedback that you previously submitted.

You can only revoke feedback that you gave (from your address).
The feedback index is returned when you submit feedback, or can be
found by reading the feedback entries.
`,
    schema: RevokeFeedbackSchema,
  })
  async revokeFeedback(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RevokeFeedbackSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const fullAgentId = args.agentId.includes(":") ? args.agentId : `${chainId}:${args.agentId}`;

      const sdk = getAgent0SDK(walletProvider);
      const handle = await sdk.revokeFeedback(fullAgentId, parseInt(args.feedbackIndex, 10));
      await handle.waitMined();

      return `Feedback revoked successfully!\n\nAgent ID: ${args.agentId}\nFeedback Index: ${args.feedbackIndex}\nTransaction hash: ${handle.hash}`;
    } catch (error) {
      return `Error revoking feedback: ${error}`;
    }
  }

  /**
   * Appends a response to feedback received by an agent you own.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param args - The feedback details and response URI
   * @returns A message confirming the response was appended
   */
  @CreateAction({
    name: "append_response",
    description: `
Appends a response to feedback on the ERC-8004 Reputation Registry.

Per ERC-8004 spec, anyone can append responses to feedback:
- Agent owners can respond to client feedback (e.g., showing a refund)
- Data intelligence aggregators can tag feedback as spam
- Auditors can add verification notes

Parameters:
- responseHash: Optional KECCAK-256 hash for non-IPFS URIs

The response is stored as a URI pointing to off-chain content.
`,
    schema: AppendResponseSchema,
  })
  async appendResponse(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AppendResponseSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const fullAgentId = args.agentId.includes(":") ? args.agentId : `${chainId}:${args.agentId}`;
      const zeroHash = "0x" + "00".repeat(32);

      const sdk = getAgent0SDK(walletProvider);
      const handle = await sdk.appendResponse(
        fullAgentId,
        args.clientAddress,
        parseInt(args.feedbackIndex, 10),
        { uri: args.responseUri, hash: args.responseHash ?? zeroHash },
      );
      await handle.waitMined();

      return `Response appended successfully!\n\nAgent ID: ${args.agentId}\nClient: ${args.clientAddress}\nFeedback Index: ${args.feedbackIndex}\nResponse URI: ${args.responseUri}\n\nTransaction hash: ${handle.hash}`;
    } catch (error) {
      return `Error appending response: ${error}`;
    }
  }

  /**
   * Gets feedback entries for an agent.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - The agentId and optional filters
   * @returns A message with the list of feedback entries
   */
  @CreateAction({
    name: "get_agent_feedback",
    description: `
Gets feedback entries for an agent. Useful for:
- Viewing all feedback received by an agent
- Filtering by reviewer addresses, value range, or tags

This is a read-only operation using indexed data for fast queries.
`,
    schema: GetAgentFeedbackSchema,
  })
  async getAgentFeedback(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentFeedbackSchema>,
  ): Promise<string> {
    try {
      const sdk = getAgent0SDK(walletProvider);
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);

      // Handle agentId format - add chainId if not present
      let agentId = args.agentId;
      if (!agentId.includes(":")) {
        agentId = `${chainId}:${agentId}`;
      }

      const feedbackItems = await sdk.searchFeedback(
        {
          agentId,
          reviewers: args.reviewerAddresses,
          includeRevoked: args.includeRevoked ?? false,
        },
        {
          minValue: args.minValue,
          maxValue: args.maxValue,
        },
      );

      // Apply pageSize limit (SDK may return all results)
      const pageSize = args.pageSize ?? 20;
      const limitedItems = feedbackItems.slice(0, pageSize);

      if (limitedItems.length === 0) {
        return `Agent ${args.agentId} has no feedback yet.`;
      }

      // Format the response
      const feedbackList = limitedItems
        .map(feedback => {
          const withA2a = feedback as typeof feedback & {
            a2aTaskId?: string;
            a2aContextId?: string;
            a2aSkills?: string[];
          };
          const reviewer = feedback.reviewer ? `Reviewer: ${feedback.reviewer}` : "";
          const value = feedback.value !== undefined ? `\n  Value: ${feedback.value}` : "";
          const tags = feedback.tags?.length ? `\n  Tags: ${feedback.tags.join(", ")}` : "";
          const endpoint = feedback.endpoint ? `\n  Endpoint: ${feedback.endpoint}` : "";
          const revoked =
            feedback.isRevoked !== undefined ? `\n  Revoked: ${feedback.isRevoked}` : "";
          const timestamp = feedback.createdAt
            ? `\n  Created: ${new Date(feedback.createdAt * 1000).toISOString()}`
            : "";
          const a2aTask = withA2a.a2aTaskId ? `\n  A2A task: ${withA2a.a2aTaskId}` : "";
          const a2aCtx = withA2a.a2aContextId ? `\n  A2A context: ${withA2a.a2aContextId}` : "";
          const a2aSkills = withA2a.a2aSkills?.length
            ? `\n  A2A skills: ${withA2a.a2aSkills.join(", ")}`
            : "";

          return `- ${reviewer}${value}${tags}${endpoint}${a2aTask}${a2aCtx}${a2aSkills}${revoked}${timestamp}`;
        })
        .join("\n\n");

      let response = `Feedback for Agent ${args.agentId} (${limitedItems.length} entries):\n\n${feedbackList}`;

      if (feedbackItems.length > pageSize) {
        response += `\n\n(${feedbackItems.length - pageSize} more results available, increase pageSize to see more)`;
      }

      return response;
    } catch (error) {
      return `Error getting agent feedback: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True if the network is supported for ERC-8004
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && isNetworkSupported(network);
}

/**
 * Factory function to create an ERC8004ReputationActionProvider
 *
 * @param config - Optional configuration including Pinata JWT
 * @returns A new ERC8004ReputationActionProvider instance
 */
export const erc8004ReputationActionProvider = (config?: ERC8004ReputationActionProviderConfig) =>
  new ERC8004ReputationActionProvider(config);
