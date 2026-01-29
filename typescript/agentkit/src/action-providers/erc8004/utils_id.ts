/**
 * Identity-specific utilities for ERC-8004 Identity Registry
 */
import { Hex } from "viem";
import { PinataConfig, uploadJsonToIPFS, formatCAIP10Address } from "./utils";

/**
 * ERC-8004 Agent Registration structure
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004#registration-v1
 */
export interface AgentRegistration {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
  name: string;
  description?: string;
  image?: string;
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
  name: string;
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
    name: params.name,
    registrations: [
      {
        agentId: params.agentId,
        agentRegistry: formatCAIP10Address(params.chainId, params.registryAddress),
      },
    ],
    supportedTrust: ["reputation"],
  };

  if (params.description) {
    registration.description = params.description;
  }

  if (params.image) {
    registration.image = params.image;
  }

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
