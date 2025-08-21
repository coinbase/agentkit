import { createWalletClient, http } from "viem";
import { EvmWalletProvider } from "../../../wallet-providers";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../../../network";

/**
 * Creates the client Clanker expects from the EvmWalletProvider
 *
 * @param walletProvider - The wallet provider instance for blockchain interactions
 * @param networkId - The network to Clank on (this will most likely be Base, unless the action implementation is extended to include other networks)
 * @returns The Clanker implementation
 */
export async function makeClanker(walletProvider: EvmWalletProvider, networkId: string) {
  const { Clanker } = await import("clanker-sdk/v4");

  const account = walletProvider.toSigner();

  const publicClient = walletProvider.getPublicClient();

  const wallet = createWalletClient({
    account,
    chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
    transport: http(),
  });

  return new Clanker({ wallet, publicClient });
}
