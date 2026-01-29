import { Hex } from "viem";
import { NETWORK_ID_TO_CHAIN_ID, Network } from "../../network";

// Chain IDs for supported networks
export const SUPPORTED_CHAIN_IDS = {
  ETHEREUM_MAINNET: 1,
  ETHEREUM_SEPOLIA: 11155111,
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532,
} as const;

// Registry addresses by chain ID
// ERC-8004 uses deterministic CREATE2 addresses across all networks
export const REGISTRY_ADDRESSES: Record<number, { identity: Hex; reputation: Hex }> = {
  [SUPPORTED_CHAIN_IDS.ETHEREUM_MAINNET]: {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  [SUPPORTED_CHAIN_IDS.ETHEREUM_SEPOLIA]: {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  [SUPPORTED_CHAIN_IDS.BASE_MAINNET]: {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  [SUPPORTED_CHAIN_IDS.BASE_SEPOLIA]: {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
};

// Supported network IDs for ERC-8004
export const SUPPORTED_NETWORK_IDS = [
  "ethereum-mainnet",
  "ethereum-sepolia",
  "base-mainnet",
  "base-sepolia",
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
 * Gets the registry address for a specific registry type and chain
 *
 * @param registry - The registry type ("identity" or "reputation")
 * @param chainId - The chain ID
 * @returns The registry address
 * @throws Error if chain is not supported
 */
export function getRegistryAddress(registry: "identity" | "reputation", chainId: number): Hex {
  const addresses = REGISTRY_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(
      `Chain ID ${chainId} is not supported for ERC-8004. Supported chain IDs: ${Object.keys(REGISTRY_ADDRESSES).join(", ")}`,
    );
  }

  return addresses[registry];
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
