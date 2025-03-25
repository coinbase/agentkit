/**
 * Flaunch Action Provider
 *
 * This file contains the implementation of the FlaunchActionProvider,
 * which provides actions for flaunch operations.
 *
 * @module flaunch
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { encodeFunctionData, decodeEventLog } from "viem";
import { base } from "viem/chains";
import { FlaunchSchema } from "./schemas";
import { generateTokenUri } from "./utils";
import {
  FastFlaunchZapAddress,
  FlaunchPositionManagerAddress,
  FAST_FLAUNCH_ZAP_ABI,
  POSITION_MANAGER_ABI,
} from "./constants";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * Configuration options for the FarcasterActionProvider.
 */
export interface FlaunchActionProviderConfig {
  /**
   * Pinata JWT.
   */
  pinataJwt?: string;
}

/**
 * FlaunchActionProvider provides actions for flaunch operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 * It supports all evm networks.
 */
export class FlaunchActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly pinataJwt: string;

  /**
   * Constructor for the FlaunchActionProvider.
   *
   * @param config - The configuration options for the FlaunchActionProvider.
   */
  constructor(config: FlaunchActionProviderConfig = {}) {
    super("flaunch", []);

    const pinataJwt = config.pinataJwt || process.env.PINATA_JWT;

    if (!pinataJwt) {
      throw new Error("PINATA_JWT is not configured.");
    }

    this.pinataJwt = pinataJwt;
  }

  /**
   * Example action implementation.
   * Replace or modify this with your actual action.
   *
   * @description
   * This is a template action that demonstrates the basic structure.
   * Replace it with your actual implementation.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by ExampleActionSchema
   * @returns A promise that resolves to a string describing the action result
   */
  @CreateAction({
    name: "flaunch",
    description: `
This tool allows launching a new memecoin using the flaunch protocol.

It takes:
- name: The name of the token
- symbol: The symbol of the token
- imageUrl: URL to the token image
- description: Description of the token

- websiteUrl: (optional) URL to the token website
- discordUrl: (optional) URL to the token Discord
- twitterUrl: (optional) URL to the token Twitter
- telegramUrl: (optional) URL to the token Telegram

Note:
- If the optional fields are not provided, don't include them in the call.
    `,
    schema: FlaunchSchema,
  })
  async flaunch(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FlaunchSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = network.chainId;

      if (!chainId) {
        throw new Error("Chain ID is not set.");
      }

      // upload image & token uri to ipfs
      const tokenUri = await generateTokenUri(args.name, {
        pinataConfig: { jwt: this.pinataJwt },
        metadata: {
          imageUrl: args.imageUrl,
          description: args.description,
          websiteUrl: args.websiteUrl,
          discordUrl: args.discordUrl,
          twitterUrl: args.twitterUrl,
          telegramUrl: args.telegramUrl,
        },
      });

      const data = encodeFunctionData({
        abi: FAST_FLAUNCH_ZAP_ABI,
        functionName: "flaunch",
        args: [
          {
            name: args.name,
            symbol: args.symbol,
            tokenUri,
            creator: walletProvider.getAddress(),
          },
        ],
      });

      const hash = await walletProvider.sendTransaction({
        to: FastFlaunchZapAddress[chainId],
        data,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(hash);

      const filteredPoolCreatedEvents = receipt.logs
        .map(log => {
          try {
            if (
              log.address.toLowerCase() !== FlaunchPositionManagerAddress[chainId].toLowerCase()
            ) {
              return null;
            }

            const event = decodeEventLog({
              abi: POSITION_MANAGER_ABI,
              data: log.data,
              topics: log.topics,
            });
            return event.eventName === "PoolCreated" ? event.args : null;
          } catch {
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);

      const memecoinAddress = filteredPoolCreatedEvents[0]?._memecoin;
      const chainSlug = Number(chainId) === base.id ? "base" : "base-sepolia";

      return `Flaunched coin ${args.symbol} (${args.name}) with transaction hash: ${hash} on ${chainSlug}\n
      View your coin on Flaunch: [${memecoinAddress}](https://flaunch.gg/${chainSlug}/coin/${memecoinAddress})`;
    } catch (error) {
      return `Error launching coin: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    // all protocol networks
    return network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
  }
}

/**
 * Factory function to create a new FlaunchActionProvider instance.
 *
 * @param config - Configuration options for the FlaunchActionProvider
 * @returns A new FlaunchActionProvider instance
 */
export const flaunchActionProvider = (config?: FlaunchActionProviderConfig) =>
  new FlaunchActionProvider(config);
