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
  GetReputationSummarySchema,
  ReadFeedbackSchema,
  GetClientsSchema,
} from "./reputationSchemas";
import { getChainIdFromNetwork, getRegistryAddress, isNetworkSupported } from "./constants";
import { REPUTATION_REGISTRY_ABI, IDENTITY_REGISTRY_ABI } from "./abi";
import { PinataConfig, ipfsToHttpUrl } from "./utils";
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
3. Submitted onchain with the IPFS URI and keccak256 hash

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

IMPORTANT: Always ignore optional fields: endpoint, mcp, a2a, oasf, proofOfPayment, and comment, unless you are explicitly asked to use them. Do not ask the user to provide them.
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

      // Check that the client is not the owner of the agent (prevent self-feedback)
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
        endpoint: args.endpoint,
        mcp: args.mcp,
        a2a: args.a2a,
        oasf: args.oasf,
        proofOfPayment: args.proofOfPayment,
        comment: args.comment,
      });

      // Submit feedback on-chain with IPFS URI and hash
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
            args.endpoint ?? "",
            feedbackUri,
            feedbackHash,
          ],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      const httpUrl = ipfsToHttpUrl(feedbackUri);

      const commentLine = args.comment ? `\nComment: ${args.comment}` : "";
      return `Feedback submitted successfully!\n\nAgent ID: ${args.agentId}\nValue: ${args.value}${args.valueDecimals ? ` (${args.valueDecimals} decimals)` : ""}\nTags: ${args.tag1 || "(none)"}${args.tag2 ? `, ${args.tag2}` : ""}\nEndpoint: ${args.endpoint || "(none)"}${commentLine}\n\nFeedback File:\n- IPFS URI: ${feedbackUri}\n- HTTP Gateway: ${httpUrl}\n- Hash: ${feedbackHash}\n\nTransaction hash: ${hash}`;
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
   * Gets aggregated reputation statistics for an agent.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - The agentId and optional tag filters
   * @returns A message with the reputation summary
   */
  @CreateAction({
    name: "get_reputation_summary",
    description: `
Gets aggregated reputation statistics for an agent from trusted clients.

Per ERC-8004 spec, clientAddresses MUST be provided to mitigate Sybil/spam attacks.
Results without filtering by clientAddresses would be vulnerable to fake feedback.

Returns:
- Total feedback count from specified clients
- Summary value (aggregated rating)
- Value decimals

You can additionally filter by tag1 and/or tag2 for category-specific summaries.
This is a read-only operation that doesn't require gas.
`,
    schema: GetReputationSummarySchema,
  })
  async getReputationSummary(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetReputationSummarySchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("reputation", chainId);

      const result = await walletProvider.readContract({
        address: registryAddress,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getSummary",
        args: [
          BigInt(args.agentId),
          args.clientAddresses as Hex[],
          args.tag1 ?? "",
          args.tag2 ?? "",
        ],
      });

      const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number];

      // Format the summary value with decimals
      let formattedValue = summaryValue.toString();
      if (summaryValueDecimals > 0) {
        const valueStr = summaryValue.toString().padStart(summaryValueDecimals + 1, "0");
        const intPart = valueStr.slice(0, -summaryValueDecimals) || "0";
        const decPart = valueStr.slice(-summaryValueDecimals);
        formattedValue = `${intPart}.${decPart}`;
      }

      const clientFilter = `\nClients: ${args.clientAddresses.length} trusted address(es)`;
      const tagFilter =
        args.tag1 || args.tag2
          ? `\nTags: ${args.tag1 || "(any)"}${args.tag2 ? ` / ${args.tag2}` : ""}`
          : "";

      return `Reputation Summary for Agent ${args.agentId}${clientFilter}${tagFilter}\n\nFeedback Count: ${count}\nSummary Value: ${formattedValue}${summaryValueDecimals > 0 ? ` (${summaryValueDecimals} decimals)` : ""}`;
    } catch (error) {
      return `Error getting reputation summary: ${error}`;
    }
  }

  /**
   * Reads a specific feedback entry.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - The agentId, clientAddress, and feedbackIndex
   * @returns A message with the feedback details
   */
  @CreateAction({
    name: "read_feedback",
    description: `
Reads a specific feedback entry from the Reputation Registry.

Returns the feedback value, decimals, tags, and revocation status.
This is a read-only operation that doesn't require gas.
`,
    schema: ReadFeedbackSchema,
  })
  async readFeedback(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ReadFeedbackSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("reputation", chainId);

      const result = await walletProvider.readContract({
        address: registryAddress,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "readFeedback",
        args: [BigInt(args.agentId), args.clientAddress as Hex, BigInt(args.feedbackIndex)],
      });

      const [value, valueDecimals, tag1, tag2, isRevoked] = result as [
        bigint,
        number,
        string,
        string,
        boolean,
      ];

      // Format the value with decimals
      let formattedValue = value.toString();
      if (valueDecimals > 0) {
        const valueStr = value.toString().padStart(valueDecimals + 1, "0");
        const intPart = valueStr.slice(0, -valueDecimals) || "0";
        const decPart = valueStr.slice(-valueDecimals);
        formattedValue = `${intPart}.${decPart}`;
      }

      return `Feedback Entry\n\nAgent ID: ${args.agentId}\nClient: ${args.clientAddress}\nFeedback Index: ${args.feedbackIndex}\n\nValue: ${formattedValue}${valueDecimals > 0 ? ` (${valueDecimals} decimals)` : ""}\nTag 1: ${tag1 || "(none)"}\nTag 2: ${tag2 || "(none)"}\nRevoked: ${isRevoked ? "Yes" : "No"}`;
    } catch (error) {
      return `Error reading feedback: ${error}`;
    }
  }

  /**
   * Gets the list of clients who have given feedback to an agent.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - The agentId to get clients for
   * @returns A message with the list of client addresses
   */
  @CreateAction({
    name: "get_feedback_clients",
    description: `
Gets the list of client addresses who have given feedback to an agent.

This is useful for iterating through all feedback entries.
This is a read-only operation that doesn't require gas.
`,
    schema: GetClientsSchema,
  })
  async getClients(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetClientsSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("reputation", chainId);

      const clients = await walletProvider.readContract({
        address: registryAddress,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getClients",
        args: [BigInt(args.agentId)],
      });

      const clientList = clients as Hex[];

      if (clientList.length === 0) {
        return `Agent ${args.agentId} has not received any feedback yet.`;
      }

      const clientListStr = clientList.map((c, i) => `${i + 1}. ${c}`).join("\n");

      return `Feedback Clients for Agent ${args.agentId}\n\nTotal: ${clientList.length} clients\n\n${clientListStr}`;
    } catch (error) {
      return `Error getting clients: ${error}`;
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
