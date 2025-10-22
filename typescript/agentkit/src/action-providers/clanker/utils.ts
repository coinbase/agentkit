import { createWalletClient, http } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../../network";
import { Clanker } from "clanker-sdk/v4";

/**
 * Creates the client Clanker expects from the EvmWalletProvider
 *
 * @param walletProvider - The wallet provider instance for blockchain interactions
 * @param networkId - The network to Clank on
 * @returns The Clanker implementation
 */
export async function createClankerClient(walletProvider: EvmWalletProvider, networkId: string) {
  const account = walletProvider.toSigner();

  const publicClient = walletProvider.getPublicClient();

  const wallet = createWalletClient({
    account,
    chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
    transport: http(publicClient.transport.url),
  });

  return new Clanker({ wallet, publicClient });
}
