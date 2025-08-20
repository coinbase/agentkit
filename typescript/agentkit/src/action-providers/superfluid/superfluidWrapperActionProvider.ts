import { z } from "zod";
import { SuperfluidWrapTokenSchema } from "./schemas";
import { ISuperTokenAbi } from "./constants";
import { encodeFunctionData, Hex, parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { abi as ERC20ABI } from "../erc20/constants";

/**
 * SuperfluidStreamActionProvider is an action provider for wrapping superfluid token.
 */
export class SuperfluidWrapperActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the SuperfluidWrapperActionProvider class.
   */
  constructor() {
    super("superfluid-wrap", []);
  }

  /**
   * Wraps a token to a Super token
   * The Super token must already exist
   * If it does not, see SuperfluidCreateSuperTokenAction
   *
   * @param walletProvider - The wallet provider to start the stream from.
   * @param args - The input arguments for the action.
   * @returns A JSON string containing the account details or error message
   */
  @CreateAction({
    name: "wrap_superfluid_token",
    description: `
This tool will directly wrap an amount of ERC20 tokens into its corresponding Super token.
The user must provide the erc20 address, and the super token address.
If this fails, the most likely culprits are:
1. You don't own any of the ERC20 token, or
2. The Super token does not exist.  If it does not exist, suggest the user create the Super token with your SuperTokenCreator action.
        `,
    schema: SuperfluidWrapTokenSchema,
  })
  async wrapToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SuperfluidWrapTokenSchema>,
  ): Promise<string> {
    try {
      const decimals = await walletProvider.readContract({
        address: args.erc20TokenAddress as Hex,
        abi: ERC20ABI,
        functionName: "decimals",
        args: [],
      });

      const amount = parseUnits(String(args.wrapAmount), Number(decimals));

      const approveData = encodeFunctionData({
        abi: ERC20ABI,
        functionName: "approve",
        args: [args.superTokenAddress as `0x${string}`, amount],
      });

      const approveHash = await walletProvider.sendTransaction({
        to: args.erc20TokenAddress as Hex,
        data: approveData,
      });

      await walletProvider.waitForTransactionReceipt(approveHash);

      const wrapData = encodeFunctionData({
        abi: ISuperTokenAbi,
        functionName: "upgrade",
        args: [amount],
      });

      const wrapHash = await walletProvider.sendTransaction({
        to: args.superTokenAddress as Hex,
        data: wrapData,
      });

      await walletProvider.waitForTransactionReceipt(wrapHash);

      return `Wrapped ${args.wrapAmount} of token ${args.erc20TokenAddress} as a SuperToken.  Transaction hash: ${wrapHash}`;
    } catch (error) {
      return `Error wrapping Superfluid token: ${error}`;
    }
  }

  /**
   * Checks if the Superfluid action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Superfluid action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}

export const superfluidWrapperActionProvider = () => new SuperfluidWrapperActionProvider();
