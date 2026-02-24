import { NETWORK_ID_TO_CHAIN_ID, Network } from "../../network";

// Supported network IDs for ERC-8004 - must match agent0 SDK (contracts.ts DEFAULT_REGISTRIES)
export const SUPPORTED_NETWORK_IDS = [
  "ethereum-mainnet", // 1
  "ethereum-sepolia", // 11155111
  "base-mainnet", // 8453
  "base-sepolia", // 84532
  "polygon-mainnet", // 137
] as const;

export type SupportedNetworkId = (typeof SUPPORTED_NETWORK_IDS)[number];

/**
 * Gets the chain ID from a network object
 *
 * @param network - The network object
 * @returns The chain ID as a number
 * @throws Error if network is not supported
 */
export function getChainIdFromNetwork(network: Network): number {
  const networkId = network.networkId;
  if (!networkId) {
    throw new Error("Network ID is not defined");
  }

  const chainIdStr = NETWORK_ID_TO_CHAIN_ID[networkId];
  if (!chainIdStr) {
    throw new Error(
      `Network ${networkId} is not supported. Supported networks: ${SUPPORTED_NETWORK_IDS.join(", ")}`,
    );
  }

  return parseInt(chainIdStr, 10);
}

/**
 * Checks if a network is supported for ERC-8004
 *
 * @param network - The network to check
 * @returns True if the network is supported
 */
export function isNetworkSupported(network: Network): boolean {
  const networkId = network.networkId;
  if (!networkId) return false;
  return SUPPORTED_NETWORK_IDS.includes(networkId as SupportedNetworkId);
}
