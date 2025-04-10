import { Network, NETWORK_ID_TO_CHAIN_ID } from "../../network";
import { Blockchain } from "@magiceden/magiceden-sdk";

/**
 * Maps a network ID to the corresponding MagicEden blockchain.
 *
 * @param networkId - The network ID to map.
 * @returns The corresponding MagicEden blockchain.
 */
export const NETWORK_ID_TO_MAGICEDEN_CHAIN: Record<string, Blockchain> = {
  "solana-mainnet": Blockchain.SOLANA,
  "ethereum-mainnet": Blockchain.ETHEREUM,
  "polygon-mainnet": Blockchain.POLYGON,
  "base-mainnet": Blockchain.BASE,
  "arbitrum-mainnet": Blockchain.ARBITRUM,
};

/**
 * Maps a chain ID to the corresponding MagicEden blockchain.
 *
 * @param chainId - The chain ID to map.
 * @returns The corresponding MagicEden blockchain.
 */
export const CHAIN_ID_TO_MAGICEDEN_CHAIN: Record<string, Blockchain> = {
  "1": Blockchain.ETHEREUM,
  "137": Blockchain.POLYGON,
  "8453": Blockchain.BASE,
  "42161": Blockchain.ARBITRUM,
  "1329": Blockchain.SEI,
  "33139": Blockchain.APECHAIN,
  "80094": Blockchain.BERACHAIN,
  "10143": Blockchain.MONAD_TESTNET,
  "56": Blockchain.BSC,
  "2741": Blockchain.ABSTRACT,
};

/**
 * Checks if the given network is supported by MagicEden.
 *
 * @param network - The network to check.
 * @returns True if the network is supported, false otherwise.
 */
export const isSupportedNetwork = (network: Network): boolean => {
  // Check if the network is supported by MagicEden
  // Currently only supports EVM and Solana
  const isSupportedProtocol =
    network.protocolFamily === "evm" || network.protocolFamily === "svm";

  // Check if the network is supported by MagicEden
  const isSupportedNetwork =
    network.networkId !== undefined && NETWORK_ID_TO_MAGICEDEN_CHAIN[network.networkId] !== undefined;

  // Check if the chain ID is supported by MagicEden
  const isSupportedChain =
    network.chainId !== undefined && CHAIN_ID_TO_MAGICEDEN_CHAIN[network.chainId] !== undefined;

  return isSupportedProtocol && (isSupportedNetwork || isSupportedChain);
};

/**
 * Gets the MagicEden blockchain from a network ID.
 *
 * @param networkId - The network ID to get the blockchain from.
 * @returns The corresponding MagicEden blockchain.
 */
export const getMagicEdenChainFromNetworkId = (networkId: string): Blockchain => {
  // First we check the known network IDs, and if they map to a chain, we return that chain
  const chainFromNetworkId = NETWORK_ID_TO_MAGICEDEN_CHAIN[networkId];
  if (chainFromNetworkId) {
    return chainFromNetworkId;
  }

  // If the chain is not found from the network ID, try to get the chain from the chain ID
  // Chain IDs always stay the same
  // If Coinbase Agentkit supports a new EVM chain, it will be supported by MagicEden through the chain ID
  // (currently there are some EVM chains MagicEden supports which Coinbase Agentkit does not)
  const chainId = NETWORK_ID_TO_CHAIN_ID[networkId];
  if (!chainId) {
    throw new Error(`Could not find chain ID for network ID: ${networkId}`);
  }

  const chainFromChainId = CHAIN_ID_TO_MAGICEDEN_CHAIN[chainId];
  if (chainFromChainId) {
    return chainFromChainId;
  }

  throw new Error(`Unsupported network ID on MagicEden: ${networkId}`);
};
