import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EnsoActionProviderParams, EnsoRouteSchema } from "./schemas";
import { getAddress, Hex, parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  ENSO_API_KEY,
  ENSO_ETH,
  ENSO_ROUTE_SINGLE_SIG,
  ENSO_SUPPORTED_NETWORKS,
} from "./constants";
import { EnsoClient, RouteParams } from "@ensofinance/sdk";

/**
 * EnsoActionProvider is an action provider for Enso.
 */
export class EnsoActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly ensoClient: EnsoClient;
  /**
   * Constructor for the EnsoActionProvider
   *
   * @param params - The initialization parameters for the Enso action provider
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
      const chainId = Number(walletProvider.getNetwork().chainId);
      if (!chainId || !ENSO_SUPPORTED_NETWORKS.has(chainId)) {
        return `Network ${chainId} is not supported by Enso`;
      }

      const fromAddress = getAddress(walletProvider.getAddress());
      const tokenIn = getAddress(args.tokenIn);
      const tokenOut = getAddress(args.tokenOut);

      const tokenInResponse = await this.ensoClient.getTokenData({
        address: tokenIn,
        chainId,
      });

      if (tokenInResponse.data.length !== 1) {
        throw `Could not find data for provided tokenIn`;
      }

      const tokenInData = tokenInResponse.data[0];
      const amountIn = parseUnits(args.amountIn, tokenInData.decimals).toString();

      const params: RouteParams = {
        chainId,
        tokenIn: [tokenIn],
        tokenOut: [tokenOut],
        amountIn: [amountIn],
        routingStrategy: "router",
        fromAddress,
        receiver: fromAddress,
        spender: fromAddress,
      };

      if (args.slippage) {
        params.slippage = args.slippage;
      }

      const routeData = await this.ensoClient.getRouteData(params);

      if (!routeData.tx.data.startsWith(ENSO_ROUTE_SINGLE_SIG)) {
        return `Unsupported calldata returned from Enso API`;
      }

      // If the tokenIn is ERC20, do approve
      if (args.tokenIn.toLowerCase() !== ENSO_ETH.toLowerCase()) {
        const approval = await this.ensoClient.getApprovalData({
          chainId,
          amount: amountIn,
          fromAddress,
          tokenAddress: getAddress(args.tokenIn),
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
    const chainIdCheck = network.chainId && ENSO_SUPPORTED_NETWORKS.has(Number(network.chainId));
    return Boolean(chainIdCheck);
  };
}

export const ensoActionProvider = () => new EnsoActionProvider();
