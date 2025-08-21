/**
 * Clanker Action Provider
 *
 * This file contains the implementation of the ClankerActionProvider,
 * which provides actions for clanker operations.
 *
 * @module clanker
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { ClankTokenSchema } from "./schemas";
import { makeClanker } from "./utils/clankerBridge";

/**
 * ClankerActionProvider provides actions for clanker operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 * It supports all evm networks.
 */
export class ClankerActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the ClankerActionProvider.
   */
  constructor() {
    super("clanker", []);
  }

  /**
   * Clanker action provider
   *
   * @description
   * This action deploys a clanker token using the Clanker sdk
   * It automatically includes the coin in the Clanker ecosystem
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Clanker arguments (modify these to fine tune token deployment, like initial quote token and rewards config)
   * @returns A promise that resolves to a string describing the clanker result
   */
  @CreateAction({
    name: "clank_token",
    description: `
This tool will launch a token (called a Clanker, named after the token launch protocol).
Clanker tokens can only be launched when your network ID is 'base-mainnet'.
  `,
    schema: ClankTokenSchema,
  })
  async clankToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ClankTokenSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const networkId = network.networkId || "base-mainnet";
    if (!networkId || networkId !== "base-mainnet") {
      return `Can't Clank token; network must be Base Mainnet`;
    }

    const clanker = await makeClanker(walletProvider, networkId);

    const lockDuration = args.lockDuration_Days * 24 * 60 * 60;
    const vestingDuration = args.vestingDuration_Days * 24 * 60 * 60;

    const tokenConfig = {
      name: args.tokenName,
      symbol: args.tokenSymbol,
      image: args.image,
      context: {
        interface: "Clanker SDK",
        platform: "Clanker",
        messageId: "Deploy Example",
        id: "TKN-1",
      },
      tokenAdmin: walletProvider.getAddress() as `0x${string}`,
      vault: {
        percentage: args.vestingPercentage,
        lockupDuration: lockDuration,
        vestingDuration: vestingDuration,
      },
    };

    const res = await clanker.deploy(tokenConfig);

    if ("error" in res) {
      return `There was an error deploying the clanker token: ${res}`;
    }

    const { txHash } = res;

    const confirmed = await res.waitForTransaction();
    if ("error" in confirmed) {
      return `There was an error confirming the clanker token deployment: ${confirmed}`;
    }

    const { address } = confirmed;

    return `Clanker token deployed at ${address}!  View the transaction at ${txHash}`;
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    // all protocol networks
    return network.protocolFamily === "evm" && network.networkId == "base-mainnet";
  }
}

/**
 * Factory function to create a new ClankerActionProvider instance.
 *
 * @returns A new ClankerActionProvider instance
 */
export const clankerActionProvider = () => new ClankerActionProvider();
