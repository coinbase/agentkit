/**
 * Maps EVM chain IDs to Coinbase network IDs
 */
export const CHAIN_ID_TO_NETWORK_ID: Record<number, string> = {
  1: "ethereum-mainnet",
  11155111: "ethereum-sepolia",
  137: "polygon-mainnet",
  80001: "polygon-mumbai",
  8453: "base-mainnet",
  84532: "base-sepolia",
  42161: "arbitrum-mainnet",
  421614: "arbitrum-sepolia",
  10: "optimism-mainnet",
  11155420: "optimism-sepolia",
};
