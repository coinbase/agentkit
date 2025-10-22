import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { WrapEthSchema, UnwrapEthSchema } from "./schemas";
import { WETH_ABI } from "./constants";
import { TOKEN_ADDRESSES_BY_SYMBOLS } from "../erc20/constants";
import { encodeFunctionData, Hex, parseUnits, formatUnits, erc20Abi } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";

/**
 * Gets the WETH address for the given network.
 *
 * @param network - The network to get the WETH address for.
 * @returns The WETH address for the network, or undefined if not supported.
 */
export const getWethAddress = (network: Network): string | undefined => {
  const networkTokens =
    TOKEN_ADDRESSES_BY_SYMBOLS[network.networkId as keyof typeof TOKEN_ADDRESSES_BY_SYMBOLS];
  return networkTokens && "WETH" in networkTokens ? networkTokens.WETH : undefined;
};

/**
 * WethActionProvider is an action provider for WETH.
 */
export class WethActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the WethActionProvider.
   */
  constructor() {
    super("weth", []);
  }

  /**
   * Wraps ETH to WETH.
   *
   * @param walletProvider - The wallet provider to use for the action.
   * @param args - The input arguments for the action.
   * @returns A message containing the transaction hash.
   */
  @CreateAction({
    name: "wrap_eth",
    description: `
    This tool wraps ETH to WETH.

Inputs:
- Amount of ETH to wrap in human-readable format (e.g., 0.1 for 0.1 ETH).
`,
    schema: WrapEthSchema,
  })
  async wrapEth(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WrapEthSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const wethAddress = getWethAddress(network);

    if (!wethAddress) {
      return `Error: WETH not supported on network ${network.networkId}`;
    }

    try {
      // Convert human-readable ETH amount to wei (ETH has 18 decimals)
      const amountInWei = parseUnits(args.amountToWrap, 18);

      // Check ETH balance before wrapping
      const ethBalance = await walletProvider.getBalance();

      if (ethBalance < amountInWei) {
        const ethBalanceFormatted = formatUnits(ethBalance, 18);
        return `Error: Insufficient ETH balance. Requested to wrap ${args.amountToWrap} ETH, but only ${ethBalanceFormatted} ETH is available.`;
      }

      const hash = await walletProvider.sendTransaction({
        to: wethAddress as Hex,
        data: encodeFunctionData({
          abi: WETH_ABI,
          functionName: "deposit",
        }),
        value: amountInWei,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Wrapped ${args.amountToWrap} ETH to WETH. Transaction hash: ${hash}`;
    } catch (error) {
      return `Error wrapping ETH: ${error}`;
    }
  }

  /**
   * Unwraps WETH to ETH.
   *
   * @param walletProvider - The wallet provider to use for the action.
   * @param args - The input arguments for the action.
   * @returns A message containing the transaction hash.
   */
  @CreateAction({
    name: "unwrap_eth",
    description: `
    This tool unwraps WETH to ETH.

Inputs:
- Amount of WETH to unwrap in human-readable format (e.g., 0.1 for 0.1 WETH).
`,
    schema: UnwrapEthSchema,
  })
  async unwrapEth(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof UnwrapEthSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const wethAddress = getWethAddress(network);

    if (!wethAddress) {
      return `Error: WETH not supported on network ${network.networkId}`;
    }

    try {
      // Convert human-readable WETH amount to wei (WETH has 18 decimals)
      const amountInWei = parseUnits(args.amountToUnwrap, 18);

      // Check WETH balance before unwrapping
      const wethBalance = await walletProvider.readContract({
        address: wethAddress as Hex,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletProvider.getAddress() as Hex],
      });

      if (wethBalance < amountInWei) {
        const wethBalanceFormatted = formatUnits(wethBalance, 18);
        return `Error: Insufficient WETH balance. Requested to unwrap ${args.amountToUnwrap} WETH, but only ${wethBalanceFormatted} WETH is available.`;
      }

      const hash = await walletProvider.sendTransaction({
        to: wethAddress as Hex,
        data: encodeFunctionData({
          abi: WETH_ABI,
          functionName: "withdraw",
          args: [amountInWei],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Unwrapped ${args.amountToUnwrap} WETH to ETH. Transaction hash: ${hash}`;
    } catch (error) {
      return `Error unwrapping WETH: ${error}`;
    }
  }

  /**
   * Checks if the Weth action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Weth action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => {
    return getWethAddress(network) !== undefined;
  };
}

export const wethActionProvider = () => new WethActionProvider();
