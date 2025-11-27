import { SUPPORTED_NETWORKS } from "@vaultsfyi/sdk";
import * as viemChains from "viem/chains";

export const SUPPORTED_CHAIN_IDS = SUPPORTED_NETWORKS.map(network =>
  viemChains[network]?.id.toString(),
).filter(id => id !== undefined) as string[];

/**
 * Get the network name from a chain id
 *
 * @param chainId - The chain id
 * @returns The network name
 */
export function getNetworkNameFromChainId(chainId: string): string | undefined {
  return SUPPORTED_NETWORKS.find(network => viemChains[network]?.id === chainId);
}
