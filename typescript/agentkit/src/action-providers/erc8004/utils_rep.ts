/**
 * Reputation-specific utilities for ERC-8004 Reputation Registry
 */
import { Hex, keccak256, toBytes } from "viem";
import { PinataConfig, uploadJsonToIPFS, formatCAIP10Address } from "./utils";

/**
 * MCP-specific context for feedback
 */
export interface McpFeedbackContext {
  tool?: string;
  prompt?: string;
  resource?: string;
}

/**
 * A2A-specific context for feedback
 */
export interface A2aFeedbackContext {
  skills?: string[];
  contextId?: string;
  taskId?: string;
}

/**
 * OASF-specific context for feedback
 */
export interface OasfFeedbackContext {
  skills?: string[];
  domains?: string[];
}

/**
 * Proof of payment context (e.g., for x402)
 */
export interface ProofOfPayment {
  fromAddress: string;
  toAddress: string;
  chainId: string;
  txHash: string;
}

/**
 * ERC-8004 Feedback File structure
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004#off-chain-feedback-file-structure
 */
export interface FeedbackFile {
  // Required fields
  agentRegistry: string;
  agentId: number;
  clientAddress: string;
  createdAt: string;
  value: number;
  valueDecimals: number;

  // Optional fields
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  mcp?: McpFeedbackContext;
  a2a?: A2aFeedbackContext;
  oasf?: OasfFeedbackContext;
  proofOfPayment?: ProofOfPayment;
  comment?: string;
}

/**
 * Parameters for generating feedback file
 */
export interface GenerateFeedbackParams {
  agentId: number;
  chainId: number;
  identityRegistryAddress: Hex;
  clientAddress: Hex;
  value: number;
  valueDecimals: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  mcp?: McpFeedbackContext;
  a2a?: A2aFeedbackContext;
  oasf?: OasfFeedbackContext;
  proofOfPayment?: ProofOfPayment;
  comment?: string;
}

/**
 * Result of uploading feedback to IPFS
 */
export interface FeedbackUploadResult {
  feedbackUri: string;
  feedbackHash: Hex;
  feedbackFile: FeedbackFile;
}

/**
 * Computes the KECCAK-256 hash of a JSON object
 *
 * @param json - The JSON object to hash
 * @returns The hash as a hex string
 */
export function computeJsonHash(json: object): Hex {
  const jsonString = JSON.stringify(json);
  return keccak256(toBytes(jsonString));
}

/**
 * Generates an ERC-8004 compliant feedback file JSON structure
 *
 * @param params - Feedback parameters
 * @returns The feedback file JSON object
 */
export function generateFeedbackFile(params: GenerateFeedbackParams): FeedbackFile {
  const feedbackFile: FeedbackFile = {
    agentRegistry: formatCAIP10Address(params.chainId, params.identityRegistryAddress),
    agentId: params.agentId,
    clientAddress: formatCAIP10Address(params.chainId, params.clientAddress),
    createdAt: new Date().toISOString(),
    value: params.value,
    valueDecimals: params.valueDecimals,
  };

  if (params.tag1) {
    feedbackFile.tag1 = params.tag1;
  }

  if (params.tag2) {
    feedbackFile.tag2 = params.tag2;
  }

  if (params.endpoint) {
    feedbackFile.endpoint = params.endpoint;
  }

  if (params.mcp) {
    feedbackFile.mcp = params.mcp;
  }

  if (params.a2a) {
    feedbackFile.a2a = params.a2a;
  }

  if (params.oasf) {
    feedbackFile.oasf = params.oasf;
  }

  if (params.proofOfPayment) {
    feedbackFile.proofOfPayment = params.proofOfPayment;
  }

  if (params.comment) {
    feedbackFile.comment = params.comment;
  }

  return feedbackFile;
}

/**
 * Generates and uploads a feedback file to IPFS
 *
 * @param pinataConfig - Pinata configuration with JWT
 * @param params - Feedback parameters
 * @returns The IPFS URI, hash, and generated feedback file
 */
export async function uploadFeedbackToIPFS(
  pinataConfig: PinataConfig,
  params: GenerateFeedbackParams,
): Promise<FeedbackUploadResult> {
  const feedbackFile = generateFeedbackFile(params);
  const feedbackHash = computeJsonHash(feedbackFile);

  const ipfsHash = await uploadJsonToIPFS(
    pinataConfig,
    feedbackFile,
    `agent-${params.agentId}-feedback-${Date.now()}`,
  );

  return {
    feedbackUri: `ipfs://${ipfsHash}`,
    feedbackHash,
    feedbackFile,
  };
}
