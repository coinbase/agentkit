import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { WrapEthSchema } from "./schemas";
import { WETH_ABI, WETH_ADDRESS } from "./constants";
import { encodeFunctionData, Hex } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";

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
    This tool can only be used to wrap ETH to WETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- Amount of ETH to wrap.

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
- 1 wei = 0.000000000000000001 WETH
- Minimum purchase amount is 100000000000000 wei (0.0000001 WETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
`,
    schema: WrapEthSchema,
  })
  async wrapEth(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WrapEthSchema>,
  ): Promise<string> {
    try {
      const hash = await walletProvider.sendTransaction({
        to: WETH_ADDRESS as Hex,
        data: encodeFunctionData({
          abi: WETH_ABI,
          functionName: "deposit",
        }),
        value: BigInt(args.amountToWrap),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Wrapped ETH with transaction hash: ${hash}`;
    } catch (error) {
      return `Error wrapping ETH: ${error}`;
    }
  }

  /**
   * Checks if the Weth action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Weth action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}

export const wethActionProvider = () => new WethActionProvider();
