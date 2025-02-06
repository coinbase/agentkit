import { WETH_ADDRESSES } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { Hex } from "viem";
import { mainnet, base, arbitrum, polygon } from "viem/chains";

/**
 * Retrieves the appropriate WETH contract address based on the chain.
 *
 * @param chainId - The chain identifier.
 * @returns The WETH contract address.
 */
export const getWethAddress = (chainId: number): string => {
  switch (chainId) {
    case mainnet.id:
      return WETH_ADDRESSES[mainnet.id];
    case base.id:
      return WETH_ADDRESSES[base.id];
    case arbitrum.id:
      return WETH_ADDRESSES[arbitrum.id];
    case polygon.id:
      return WETH_ADDRESSES[polygon.id];
    default:
      throw new Error(`Unsupported chain: ${chainId}`);
  }
};

/**
 * Maps the chain identifier to Magic Eden's chain naming convention.
 *
 * @param chainId - The chain identifier.
 * @returns The chain name used by Magic Eden APIs.
 */
export const toMagicEdenChain = (chainId: number): string => {
  switch (chainId) {
    case mainnet.id:
      return "ethereum";
    case base.id:
      return "base";
    case arbitrum.id:
      return "arbitrum";
    case polygon.id:
      return "polygon";
    default:
      throw new Error(`Unsupported chain: ${chainId}`);
  }
};

/**
 * Submits a transaction via the wallet provider.
 *
 * @param walletProvider - The wallet provider to use.
 * @param to - Recipient address.
 * @param from - Sender address.
 * @param data - Transaction data payload.
 * @param value - (Optional) Value to send (in wei as a string).
 * @returns The transaction hash.
 */
export const submitTransaction = async (
  walletProvider: EvmWalletProvider,
  to: Hex,
  from: Hex,
  data: Hex,
  value?: string,
): Promise<`0x${string}`> => {
  const txHash = await walletProvider.sendTransaction({
    to,
    from,
    data,
    ...(value ? { value: BigInt(value) } : {}),
  });

  return txHash;
};
