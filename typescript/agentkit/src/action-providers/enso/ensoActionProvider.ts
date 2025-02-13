import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EnsoActionProviderParams, EnsoRouteSchema } from "./schemas";
import { getAddress, Hex } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  ENSO_API_KEY,
  ENSO_ETH,
  ENSO_ROUTE_SINGLE_SIG,
  ENSO_SUPPORTED_NETWORKS,
  ENSO_SUPPORTED_NETWORKS_SET,
} from "./constants";
import { EnsoClient, RouteParams } from "@ensofinance/sdk";

/**
 * EnsoActionProvider is an action provider for Enso.
 */
export class EnsoActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly ensoClient: EnsoClient;
  /**
   * Constructor for the EnsoActionProvider
   */
  constructor(params: EnsoActionProviderParams = {}) {
    super("enso", []);
    this.ensoClient = new EnsoClient({ apiKey: params.apiKey || ENSO_API_KEY });
  }

  /**
   * Finds the optimal route from a token to a token and executes it.
   *
   * @param walletProvider - The wallet to execute the transaction from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token route details.
   */
  @CreateAction({
    name: "route",
    description: `This tool will find the optimal route for entering or exiting any DeFi position or swapping any ERC20 tokens.`,
    schema: EnsoRouteSchema,
  })
  async route(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof EnsoRouteSchema>,
  ): Promise<string> {
    try {
      const chainId = ENSO_SUPPORTED_NETWORKS.get(args.network);
      if (!chainId) {
        return `Network ${args.network} is not supported by Enso`;
      }

      const fromAddress = getAddress(walletProvider.getAddress());
      const tokenIn = getAddress(args.tokenIn);
      const tokenOut = getAddress(args.tokenOut);

      const params: RouteParams = {
        chainId,
        tokenIn,
        tokenOut,
        amountIn: args.amountIn.toString(),
        routingStrategy: "router",
        fromAddress,
        receiver: fromAddress,
        spender: fromAddress,
      };

      if (args.slippage) {
        params.slippage = args.slippage;
      }

      const routeData = await this.ensoClient.getRouterData(params);

      if (!routeData.tx.data.startsWith(ENSO_ROUTE_SINGLE_SIG)) {
        return `Unsupported calldata returned from Enso API`;
      }

      // If the tokenIn is ERC20, do approve
      if (args.tokenIn.toLowerCase() !== ENSO_ETH.toLowerCase()) {
        const approval = await this.ensoClient.getApprovalData({
          chainId,
          amount: args.amountIn.toString(),
          fromAddress,
          tokenAddress: getAddress(args.tokenIn),
          routingStrategy: "router",
        });

        const hash = await walletProvider.sendTransaction({
          to: approval.tx.to,
          data: approval.tx.data as Hex,
        });
        await walletProvider.waitForTransactionReceipt(hash);
      }

      const hash = await walletProvider.sendTransaction({
        to: routeData.tx.to,
        value: BigInt(routeData.tx.value),
        data: routeData.tx.data as Hex,
      });
      await walletProvider.waitForTransactionReceipt(hash);

      return `Route executed successfully, transaction hash: ${hash}`;
    } catch (error) {
      return `Error routing token through Enso: ${error}`;
    }
  }

  /**
   * Checks if the Enso action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Enso action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => {
    const chainIdCheck =
      network.chainId && ENSO_SUPPORTED_NETWORKS_SET.has(Number(network.chainId));
    const networkIdCheck = network.networkId && ENSO_SUPPORTED_NETWORKS.has(network.networkId);

    return Boolean(chainIdCheck) || Boolean(networkIdCheck);
  };
}

export const ensoActionProvider = () => new EnsoActionProvider();
