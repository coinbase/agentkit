// ERC-8004 Action Providers
export * from "./erc8004IdentityActionProvider";
export * from "./erc8004ReputationActionProvider";

// Schemas
export * from "./identitySchemas";
export * from "./reputationSchemas";

// Constants
export {
  SUPPORTED_CHAIN_IDS,
  REGISTRY_ADDRESSES,
  SUPPORTED_NETWORK_IDS,
  getChainIdFromNetwork,
  getRegistryAddress,
  isNetworkSupported,
} from "./constants";

export type { SupportedNetworkId } from "./constants";

// Shared utilities
export { uploadJsonToIPFS, uploadFileToIPFS, ipfsToHttpUrl, formatCAIP10Address } from "./utils";

export type { PinataConfig } from "./utils";

// Identity utilities
export { generateAgentRegistration, uploadAgentRegistration } from "./utils_id";

export type { AgentRegistration, GenerateRegistrationParams } from "./utils_id";

// Reputation utilities
export { generateFeedbackFile, uploadFeedbackToIPFS, computeJsonHash } from "./utils_rep";

export type {
  FeedbackFile,
  GenerateFeedbackParams,
  FeedbackUploadResult,
  McpFeedbackContext,
  A2aFeedbackContext,
  OasfFeedbackContext,
  ProofOfPayment,
} from "./utils_rep";
