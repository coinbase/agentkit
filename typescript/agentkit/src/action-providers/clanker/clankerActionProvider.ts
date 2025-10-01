import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { ClankTokenSchema } from "./schemas";
import { encodeFunctionData } from "viem";

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
   * This action deploys a clanker token using the Clanker SDK
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Clanker arguments (modify these to fine tune token deployment, like initial quote token and rewards config)
   * @returns A promise that resolves to a string describing the clanker result
   */
  @CreateAction({
    name: "clank_token",
    description: `
This action deploys a clanker token using the Clanker SDK.
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
    if (!this.supportsNetwork(network)) {
      return `Can't Clank token; network ${networkId} is not supported`;
    }

    const { Clanker } = await import("clanker-sdk/v4");
    const clanker = new Clanker({ publicClient: walletProvider.getPublicClient() });

    const lockDuration = args.lockDuration_Days * 24 * 60 * 60;
    const vestingDuration = args.vestingDuration_Days * 24 * 60 * 60;

    const tokenConfig = {
      name: args.tokenName,
      symbol: args.tokenSymbol,
      image: args.image,
      ...(args.socialMediaUrls || args.description
        ? {
            metadata: {
              ...(args.socialMediaUrls && { socialMediaUrls: args.socialMediaUrls }),
              ...(args.description && { description: args.description }),
            },
          }
        : {}),
      context: {
        interface: args.interface,
        ...(args.id && { id: args.id }),
      },
      tokenAdmin: walletProvider.getAddress() as `0x${string}`,
      vault: {
        percentage: args.vaultPercentage,
        lockupDuration: lockDuration,
        vestingDuration: vestingDuration,
      },
      chainId: Number(network.chainId) as 8453 | 84532 | 42161 | undefined,
    };

    const deployTransaction = await clanker.getDeployTransaction(tokenConfig);
    console.log("deployTransaction", deployTransaction);
    console.log("tokenConfig", deployTransaction.args[0].tokenConfig);

    // Encode the function data properly for sendTransaction
    const data = encodeFunctionData({
      abi: deployTransaction.abi,
      functionName: deployTransaction.functionName,
      args: deployTransaction.args,
    });

    try {
      const gas = await walletProvider.getPublicClient().estimateContractGas({
        ...deployTransaction,
        account: walletProvider.getAddress() as `0x${string}`,
      });
      console.log("estimateContractGas:", gas);
    } catch (error) {
      console.log("error in estimateContractGas", error);
    }

    try {
      const gas = await walletProvider.getPublicClient().estimateGas({
        account: walletProvider.getAddress() as `0x${string}`,
        to: deployTransaction.address,
        value: deployTransaction.value,
        data: data,
      });
      console.log("estimateGas:", gas);
    } catch (error) {
      console.log("error in estimateGas", error);
    }

    try {
      const txHash = await walletProvider.sendTransaction({
        to: deployTransaction.address,
        data,
        value: deployTransaction.value,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);
      console.log("receipt", receipt);

      if (receipt.status === "reverted" || receipt.status === "failed") 
        return `The transaction reverted: ${receipt.status}`;

      // Extract token address from logs
      // The token address is in the first Transfer event from null address (token minting)
      const transferEventSignature =
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const nullAddress = "0x0000000000000000000000000000000000000000000000000000000000000000";

      const tokenLog = receipt.logs.find(
        log => log.topics[0] === transferEventSignature && log.topics[1] === nullAddress,
      );

      const tokenAddress = tokenLog?.address;
      if (tokenAddress) {
        return `Clanker token deployed at address ${tokenAddress}! View the transaction at ${txHash}. View the token page at https://clanker.world/clanker/${tokenAddress}`;
      }

      return `Clanker token deployed! View the transaction at ${txHash}`;
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
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" ||
    network.networkId === "base-sepolia" ||
    network.networkId === "arbitrum-mainnet";
}

/**
 * Factory function to create a new ClankerActionProvider instance.
 *
 * @returns A new ClankerActionProvider instance
 */
export const clankerActionProvider = () => new ClankerActionProvider();
