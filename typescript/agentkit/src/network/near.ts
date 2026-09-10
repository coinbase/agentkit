import { Network } from "./types";

/** AgentKit network IDs for NEAR. */
export const NEAR_MAINNET_NETWORK_ID = "near-mainnet";
export const NEAR_TESTNET_NETWORK_ID = "near-testnet";
export type NEAR_NETWORK_ID = typeof NEAR_MAINNET_NETWORK_ID | typeof NEAR_TESTNET_NETWORK_ID;

/** NEAR protocol family used by AgentKit network matching. */
export const NEAR_PROTOCOL_FAMILY = "near";

/** Canonical NEAR chain IDs. */
export const NEAR_MAINNET_CHAIN_ID = "mainnet";
export const NEAR_TESTNET_CHAIN_ID = "testnet";

/** Canonical public RPC endpoints. */
export const NEAR_MAINNET_RPC_URL = "https://rpc.mainnet.fastnear.com";
export const NEAR_TESTNET_RPC_URL = "https://rpc.testnet.fastnear.com";

export const NEAR_MAINNET_NETWORK: Network = {
  protocolFamily: NEAR_PROTOCOL_FAMILY,
  chainId: NEAR_MAINNET_CHAIN_ID,
  networkId: NEAR_MAINNET_NETWORK_ID,
};

export const NEAR_TESTNET_NETWORK: Network = {
  protocolFamily: NEAR_PROTOCOL_FAMILY,
  chainId: NEAR_TESTNET_CHAIN_ID,
  networkId: NEAR_TESTNET_NETWORK_ID,
};

/** Network metadata indexed by AgentKit network ID. */
export const NEAR_NETWORKS: Record<NEAR_NETWORK_ID, Network> = {
  [NEAR_MAINNET_NETWORK_ID]: NEAR_MAINNET_NETWORK,
  [NEAR_TESTNET_NETWORK_ID]: NEAR_TESTNET_NETWORK,
};

/** Default RPC endpoints indexed by AgentKit network ID. */
export const NEAR_RPC_URLS: Record<NEAR_NETWORK_ID, string> = {
  [NEAR_MAINNET_NETWORK_ID]: NEAR_MAINNET_RPC_URL,
  [NEAR_TESTNET_NETWORK_ID]: NEAR_TESTNET_RPC_URL,
};

/**
 * Convert an AgentKit NEAR network ID to its CAIP-2 identifier.
 *
 * @param networkId - AgentKit NEAR network ID.
 * @returns The corresponding CAIP-2 identifier.
 */
export function getNearCaip2Network(networkId: NEAR_NETWORK_ID): `near:${string}` {
  return `near:${NEAR_NETWORKS[networkId].chainId}`;
}
