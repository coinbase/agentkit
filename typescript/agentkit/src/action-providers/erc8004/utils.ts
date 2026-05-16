/**
 * Shared utilities for ERC-8004 action providers
 */

import { SDK as Agent0SDK } from "agent0-sdk";
import { EvmWalletProvider } from "../../wallet-providers";
import { getChainIdFromNetwork } from "./constants";

/**
 * Creates an Agent0SDK instance from a wallet provider.
 *
 * The wallet provider is bridged via {@link toEip1193Provider} so the SDK can
 * send transactions through agentkit's wallet abstraction (including smart wallets).
 *
 * @param walletProvider - The wallet provider to extract chain/RPC/signer from
 * @param pinataJwt - Optional Pinata JWT for IPFS uploads
 * @returns An initialized Agent0SDK instance
 * @throws Error if unable to determine RPC URL
 */
export function getAgent0SDK(walletProvider: EvmWalletProvider, pinataJwt?: string): Agent0SDK {
  const network = walletProvider.getNetwork();
  const chainId = getChainIdFromNetwork(network);

  const publicClient = walletProvider.getPublicClient();
  const rpcUrl = publicClient.transport.url;

  if (!rpcUrl) {
    throw new Error("Unable to determine RPC URL from wallet provider");
  }

  return new Agent0SDK({
    chainId,
    rpcUrl,
    walletProvider: walletProvider.toEip1193Provider(),
    ...(pinataJwt ? { ipfs: "pinata" as const, pinataJwt } : {}),
  });
}
