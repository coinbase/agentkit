import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { ClankTokenSchema } from "./schemas";
import { createClankerClient } from "./utils";

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
his tool will launch a Clanker token using the Clanker SDK.
It takes the following inputs:
- tokenName: The name of the deployed token
- tokenSymbol: The symbol of the deployed token  
- description: An optional description of the token or token project
- socialMediaUrls: An optional array of social media links for the token, each with a platform and url
- image: A normal or ipfs URL pointing to the image of the token
- vaultPercentage: The percentage of the token supply to allocate to a vault accessible to the deployed after the lockup period with optional vesting
- lockDuration_Days: The lock duration of the tokens in the vault (in days) (minimum 7 days)
- vestingDuration_Days: The duration (in days) that the token should vest after lockup period, vesting is linear.
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

    const clanker = await createClankerClient(walletProvider, networkId);

    const lockDuration = args.lockDuration_Days * 24 * 60 * 60;
    const vestingDuration = args.vestingDuration_Days * 24 * 60 * 60;

    const tokenConfig = {
      name: args.tokenName,
      symbol: args.tokenSymbol,
      image: args.image,
      description: args.description,
      socialMediaUrls: args.socialMediaUrls,
      context: {
        interface: args.interface,
        id: args.id,
      },
      tokenAdmin: walletProvider.getAddress() as `0x${string}`,
      vault: {
        percentage: args.vaultPercentage,
        lockupDuration: lockDuration,
        vestingDuration: vestingDuration,
      },
    };

    try {
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

      return `Clanker token deployed at ${address}!  View the transaction at ${txHash}, or view the token page at https://clanker.world/clanker/${address}`;
    } catch (error) {
      return `There was an error deploying the clanker token: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm" && network.networkId == "base-mainnet";
  }
}

/**
 * Factory function to create a new ClankerActionProvider instance.
 *
 * @returns A new ClankerActionProvider instance
 */
export const clankerActionProvider = () => new ClankerActionProvider();
