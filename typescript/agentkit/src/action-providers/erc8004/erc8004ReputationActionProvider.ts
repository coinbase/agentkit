import { z } from "zod";
import { Hex, encodeFunctionData, zeroHash } from "viem";
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
import { getChainIdFromNetwork, getRegistryAddress, isNetworkSupported } from "./constants";
import { REPUTATION_REGISTRY_ABI, IDENTITY_REGISTRY_ABI } from "./abi";
import { PinataConfig, ipfsToHttpUrl, getAgent0SDK } from "./utils";
import { uploadFeedbackToIPFS } from "./utils_rep";

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
  private pinataConfig?: PinataConfig;

  /**
   * Constructor for the ERC8004ReputationActionProvider.
   *
   * @param config - Optional configuration including Pinata JWT for IPFS uploads
   */
  constructor(config?: ERC8004ReputationActionProviderConfig) {
    super("erc8004_reputation", []);
    if (config?.pinataJwt) {
      this.pinataConfig = { jwt: config.pinataJwt };
    }
  }

  /**
   * Gives feedback to an agent.
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

The feedback is automatically:
1. Generated as an ERC-8004 compliant JSON file
2. Uploaded to IPFS via Pinata
3. Submitted onchain with the IPFS URI

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
      if (!this.pinataConfig) {
        return "Error: PINATA_JWT is required for giving feedback. Please configure the provider with a Pinata JWT.";
      }

      console.log("args", args);

      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const reputationRegistryAddress = getRegistryAddress("reputation", chainId);
      const identityRegistryAddress = getRegistryAddress("identity", chainId);
      const clientAddress = walletProvider.getAddress();

      // Check that the client is not the owner of the agent
      const agentOwner = await walletProvider.readContract({
        address: identityRegistryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [BigInt(args.agentId)],
      });

      if ((agentOwner as string).toLowerCase() === clientAddress.toLowerCase()) {
        return "Error: You cannot give feedback to your own agent.";
      }

      // Generate and upload feedback file to IPFS
      const { feedbackUri, feedbackHash } = await uploadFeedbackToIPFS(this.pinataConfig, {
        agentId: parseInt(args.agentId, 10),
        chainId,
        identityRegistryAddress,
        clientAddress: clientAddress as Hex,
        value: args.value,
        valueDecimals: args.valueDecimals ?? 0,
        tag1: args.tag1,
        tag2: args.tag2,
        endpoint: undefined,
        mcp: undefined,
        a2a: undefined,
        oasf: undefined,
        proofOfPayment: undefined,
        comment: args.comment,
      });

      // Submit feedback onchain with IPFS URI and hash
      const hash = await walletProvider.sendTransaction({
        to: reputationRegistryAddress,
        data: encodeFunctionData({
          abi: REPUTATION_REGISTRY_ABI,
          functionName: "giveFeedback",
          args: [
            BigInt(args.agentId),
            BigInt(args.value),
            args.valueDecimals ?? 0,
            args.tag1 ?? "",
            args.tag2 ?? "",
            "",
            feedbackUri,
            feedbackHash,
          ],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      const httpUrl = ipfsToHttpUrl(feedbackUri);

      const commentLine = args.comment ? `\nComment: ${args.comment}` : "";
      return `Feedback submitted successfully!\n\nAgent ID: ${args.agentId}\nValue: ${args.value}${args.valueDecimals ? ` (${args.valueDecimals} decimals)` : ""}\nTags: ${args.tag1 || "(none)"}${args.tag2 ? `, ${args.tag2}` : ""}${commentLine}\n\nFeedback File:\n- IPFS URI: ${feedbackUri}\n- HTTP Gateway: ${httpUrl}\n- Hash: ${feedbackHash}\n\nTransaction hash: ${hash}`;
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
      const registryAddress = getRegistryAddress("reputation", chainId);

      const hash = await walletProvider.sendTransaction({
        to: registryAddress,
        data: encodeFunctionData({
          abi: REPUTATION_REGISTRY_ABI,
          functionName: "revokeFeedback",
          args: [BigInt(args.agentId), BigInt(args.feedbackIndex)],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Feedback revoked successfully!\n\nAgent ID: ${args.agentId}\nFeedback Index: ${args.feedbackIndex}\nTransaction hash: ${hash}`;
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
      const registryAddress = getRegistryAddress("reputation", chainId);

      const hash = await walletProvider.sendTransaction({
        to: registryAddress,
        data: encodeFunctionData({
          abi: REPUTATION_REGISTRY_ABI,
          functionName: "appendResponse",
          args: [
            BigInt(args.agentId),
            args.clientAddress as Hex,
            BigInt(args.feedbackIndex),
            args.responseUri,
            (args.responseHash as Hex) ?? zeroHash,
          ],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Response appended successfully!\n\nAgent ID: ${args.agentId}\nClient: ${args.clientAddress}\nFeedback Index: ${args.feedbackIndex}\nResponse URI: ${args.responseUri}\n\nTransaction hash: ${hash}`;
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
          const reviewer = feedback.reviewer ? `Reviewer: ${feedback.reviewer}` : "";
          const value = feedback.value !== undefined ? `\n  Value: ${feedback.value}` : "";
          const tags = feedback.tags?.length ? `\n  Tags: ${feedback.tags.join(", ")}` : "";
          const endpoint = feedback.endpoint ? `\n  Endpoint: ${feedback.endpoint}` : "";
          const revoked =
            feedback.isRevoked !== undefined ? `\n  Revoked: ${feedback.isRevoked}` : "";
          const timestamp = feedback.createdAt
            ? `\n  Created: ${new Date(feedback.createdAt * 1000).toISOString()}`
            : "";

          return `- ${reviewer}${value}${tags}${endpoint}${revoked}${timestamp}`;
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
