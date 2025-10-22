import { z } from "zod";
import { CdpClient } from "@coinbase/cdp-sdk";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { isWalletProviderWithClient } from "../../wallet-providers/cdpShared";
import { RequestFaucetFundsV2Schema } from "./schemas";

/**
 * Gets or creates a CDP client from the wallet provider or environment variables.
 *
 * @param walletProvider - The wallet provider to get the client from.
 * @returns The CDP client.
 */
export function getCdpClient(walletProvider: WalletProvider): CdpClient {
  if (isWalletProviderWithClient(walletProvider)) {
    return walletProvider.getClient();
  }

  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      "Faucet requires CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables to be set.",
    );
  }

  return new CdpClient({ apiKeyId, apiKeySecret });
}

/**
 * Validates that the network and protocol family are supported for faucet operations.
 *
 * @param network - The network to validate.
 * @param networkId - The network ID to validate.
 */
export function validateNetworkSupport(network: Network, networkId: string): void {
  const supportedProtocols = ["evm", "svm"];
  if (!supportedProtocols.includes(network.protocolFamily)) {
    throw new Error("Faucet is only supported on Ethereum and Solana protocol families.");
  }

  const supportedEvmNetworks = ["base-sepolia", "ethereum-sepolia"];
  const supportedSvmNetworks = ["solana-devnet"];

  const isEvmSupported =
    network.protocolFamily === "evm" && supportedEvmNetworks.includes(networkId);
  const isSvmSupported =
    network.protocolFamily === "svm" && supportedSvmNetworks.includes(networkId);

  if (!isEvmSupported && !isSvmSupported) {
    const supportedNetworks =
      network.protocolFamily === "evm"
        ? supportedEvmNetworks.join(" or ")
        : supportedSvmNetworks.join(" or ");
    throw new Error(
      `Faucet is only supported on ${supportedNetworks} ${network.protocolFamily} networks.`,
    );
  }
}

/**
 * Handles faucet requests for EVM networks.
 *
 * @param cdpClient - The CDP client to use.
 * @param address - The address to request funds from.
 * @param networkId - The network ID to request funds from.
 * @param args - The arguments to request funds from.
 * @returns The transaction hash.
 */
export async function handleEvmFaucet(
  cdpClient: CdpClient,
  address: string,
  networkId: string,
  args: z.infer<typeof RequestFaucetFundsV2Schema>,
): Promise<string> {
  const token = (args.assetId || "eth") as "eth" | "usdc" | "eurc" | "cbbtc";

  const faucetTx = await cdpClient.evm.requestFaucet({
    address,
    token,
    network: networkId as "base-sepolia" | "ethereum-sepolia",
  });

  return `Received ${args.assetId || "ETH"} from the faucet. Transaction hash: ${faucetTx.transactionHash}`;
}

/**
 * Handles faucet requests for Solana networks.
 *
 * @param cdpClient - The CDP client to use.
 * @param address - The address to request funds from.
 * @param args - The arguments to request funds from.
 * @returns The transaction hash.
 */
export async function handleSvmFaucet(
  cdpClient: CdpClient,
  address: string,
  args: z.infer<typeof RequestFaucetFundsV2Schema>,
): Promise<string> {
  const token = (args.assetId || "sol") as "sol" | "usdc";

  const faucetTx = await cdpClient.solana.requestFaucet({
    address,
    token,
  });

  return `Received ${args.assetId || "SOL"} from the faucet. Transaction signature hash: ${faucetTx.signature}`;
}
