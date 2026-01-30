/**
 * Identity-specific utilities for ERC-8004 Identity Registry
 */
import { Hex } from "viem";
import { PinataConfig, uploadJsonToIPFS, formatCAIP10Address, ipfsToHttpUrl } from "./utils";

/**
 * ERC-8004 Agent Registration structure
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004#registration-v1
 */
export interface AgentRegistration {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
  name: string;
  description: string;
  image: string;
  registrations: Array<{
    agentId: number;
    agentRegistry: string; // CAIP-10 format
  }>;
  supportedTrust: Array<"reputation" | "crypto-economic" | "tee-attestation">;
}

/**
 * Parameters for generating agent registration
 */
export interface GenerateRegistrationParams {
  agentId: number;
  chainId: number;
  registryAddress: Hex;
  name?: string;
  description?: string;
  image?: string;
}

/**
 * Generates an ERC-8004 compliant agent registration JSON structure
 *
 * @param params - Registration parameters
 * @returns The registration JSON object
 */
export function generateAgentRegistration(params: GenerateRegistrationParams): AgentRegistration {
  const registration: AgentRegistration = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: params.name || `Agent ${params.agentId}`,
    description: params.description || "",
    image: params.image || "",
    registrations: [
      {
        agentId: params.agentId,
        agentRegistry: formatCAIP10Address(params.chainId, params.registryAddress),
      },
    ],
    supportedTrust: ["reputation"],
  };

  return registration;
}

/**
 * Generates and uploads an agent registration to IPFS
 *
 * @param pinataConfig - Pinata configuration with JWT
 * @param params - Registration parameters
 * @returns The IPFS URI (ipfs://...)
 */
export async function uploadAgentRegistration(
  pinataConfig: PinataConfig,
  params: GenerateRegistrationParams,
): Promise<string> {
  const registration = generateAgentRegistration(params);
  const ipfsHash = await uploadJsonToIPFS(
    pinataConfig,
    registration,
    `agent-${params.agentId}-registration`,
  );
  return `ipfs://${ipfsHash}`;
}

/**
 * Fetches an agent registration JSON from IPFS
 *
 * @param ipfsUri - The IPFS URI (ipfs://...) or HTTP gateway URL
 * @returns The agent registration JSON
 */
export async function fetchAgentRegistration(ipfsUri: string): Promise<AgentRegistration> {
  const httpUrl = ipfsToHttpUrl(ipfsUri);

  const response = await fetch(httpUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch registration from IPFS: ${response.statusText}`);
  }

  const registration = (await response.json()) as AgentRegistration;

  // Validate it's an ERC-8004 registration
  if (registration.type !== "https://eips.ethereum.org/EIPS/eip-8004#registration-v1") {
    throw new Error(`Invalid registration type: ${registration.type}`);
  }

  return registration;
}

/**
 * Updates an existing agent registration with new values
 *
 * @param existing - The existing registration JSON
 * @param updates - The fields to update (only non-undefined values are applied)
 * @param updates.name - Optional new name for the agent
 * @param updates.description - Optional new description for the agent
 * @param updates.image - Optional new image URL for the agent
 * @returns A new registration object with updates applied
 */
export function updateAgentRegistration(
  existing: AgentRegistration,
  updates: { name?: string; description?: string; image?: string },
): AgentRegistration {
  return {
    ...existing,
    name: updates.name !== undefined ? updates.name : existing.name,
    description: updates.description !== undefined ? updates.description : existing.description,
    image: updates.image !== undefined ? updates.image : existing.image,
  };
}
