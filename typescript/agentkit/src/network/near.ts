import { Network } from "./types";

// CDP Network IDs
export const NEAR_MAINNET_NETWORK_ID = "near-mainnet";
export const NEAR_TESTNET_NETWORK_ID = "near-testnet";
export type NEAR_NETWORK_ID = typeof NEAR_MAINNET_NETWORK_ID | typeof NEAR_TESTNET_NETWORK_ID;

// AgentKit Protocol Family
export const NEAR_PROTOCOL_FAMILY = "near";

export const NEAR_MAINNET_NETWORK: Network = {
  protocolFamily: NEAR_PROTOCOL_FAMILY,
  chainId: undefined,
  networkId: NEAR_MAINNET_NETWORK_ID,
};

export const NEAR_TESTNET_NETWORK: Network = {
  protocolFamily: NEAR_PROTOCOL_FAMILY,
  chainId: undefined,
  networkId: NEAR_TESTNET_NETWORK_ID,
};

export const NEAR_NETWORKS: Record<NEAR_NETWORK_ID, Network> = {
  [NEAR_MAINNET_NETWORK_ID]: NEAR_MAINNET_NETWORK,
  [NEAR_TESTNET_NETWORK_ID]: NEAR_TESTNET_NETWORK,
};
