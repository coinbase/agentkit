import { Chain } from "opensea-js";

/**
 * Supported Opensea chains
 */
export const supportedChains: Record<string, Chain> = {
  "1": Chain.Mainnet,
  "137": Chain.Polygon,
  "80002": Chain.Amoy,
  "11155111": Chain.Sepolia,
  "8217": Chain.Klaytn,
  "1001": Chain.Baobab,
  "43114": Chain.Avalanche,
  "43113": Chain.Fuji,
  "42161": Chain.Arbitrum,
  "42170": Chain.ArbitrumNova,
  "421614": Chain.ArbitrumSepolia,
  "238": Chain.Blast,
  "168587773": Chain.BlastSepolia,
  "8453": Chain.Base,
  "84532": Chain.BaseSepolia,
  "10": Chain.Optimism,
  "11155420": Chain.OptimismSepolia,
  "7777777": Chain.Zora,
  "999999999": Chain.ZoraSepolia,
  "1329": Chain.Sei,
  "1328": Chain.SeiTestnet,
  "8333": Chain.B3,
  "1993": Chain.B3Sepolia,
  "80094": Chain.BeraChain,
};

/**
 * Maps EVM chain IDs to Opensea chain
 *
 * @param chainId - The EVM chain ID to map
 * @returns The corresponding OpenSea Chain enum value
 */
export const chainIdToOpenseaChain = (chainId: string): Chain => {
  const chain = supportedChains[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID on Opensea: ${chainId}`);
  }
  return chain;
};
