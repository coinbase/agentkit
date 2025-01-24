import { CdpAction } from "../../cdp_action";
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { EnsoClient, RouteParams } from "@ensofinance/sdk";
import { z } from "zod";
import {
  ENSO_API_KEY,
  ENSO_ETH,
  ENSO_ROUTE_SINGLE_SIG,
  ENSO_ROUTER_ABI,
  ENSO_SUPPORTED_NETWORKS,
  MIN_ERC20_ABI,
} from "../constants";
import { Address, decodeFunctionData, Hex } from "viem";

// TODO: Make sure the prompt is descriptive
const ENSO_ROUTE_PROMPT = `
This tool can be used to route from ERC-20 token to ERC-20 token. The following actions are supported by Enso Route:
- swap
- deposit
- borrow
- lend

Inputs:
- ERC20 token address to route from
- ERC20 token address to route to
- Amount of token to route from (in wei)
- Slippage in basis points (optional)

Important notes:
- The amount is a string and cannot have any decimals points, the unit of measurement is wei.
- Make sure to use correct decimal precision for the amountIn, each token has different decimal precision.
- Only supported on the following networks:
  - Base Mainnet (ie, 'base', 'base-mainnet')
  - Ethereum Mainnet (ie, 'ethereum-mainnet')
  - Arbitrum Mainnet (ie, 'arbitrum-mainnet')
  - Polygon Mainnet (ie, 'polygon-mainnet')
  - Base Sepolia (ie, 'base-sepolia')
`;

/**
 * Input schema for route action.
 */
export const EnsoRouteInput = z
  .object({
    tokenIn: z
      .string()
      .describe(
        "Address of the token to swap from. For ETH, use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      ),
    tokenOut: z
      .string()
      .describe(
        "Address of the token to swap to, For ETH, use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      ),
    amountIn: z.string().describe("Amount of tokenIn to swap in wei"),
    slippage: z.number().optional().describe("Slippage in basis points (1/10000). Default - 300"),
  })
  .strip()
  .describe("Instructions for routing through Enso API");

/**
 * Executes the best route from a token to a token
 *
 * @param wallet - The wallet to create the token from.
 * @param args - The input arguments for the action.
 * @returns A message containing the token purchase details.
 */
export async function ensoRoute(
  wallet: Wallet,
  args: z.infer<typeof EnsoRouteInput>,
): Promise<string> {
  try {
    const chainId = ENSO_SUPPORTED_NETWORKS.get(wallet.getNetworkId());
    if (!chainId) {
      return `Network ${wallet.getNetworkId()} is not supported by Enso`;
    }

    const fromAddress = (await wallet.getDefaultAddress()).toString() as Address;

    const params: RouteParams = {
      chainId,
      tokenIn: args.tokenIn as Address,
      tokenOut: args.tokenOut as Address,
      amountIn: args.amountIn,
      routingStrategy: "router", // I think we are limited to use router
      fromAddress,
      receiver: fromAddress,
      spender: fromAddress,
    };

    if (args.slippage) {
      params.slippage = args.slippage;
    }

    const ensoClient = new EnsoClient({ apiKey: ENSO_API_KEY });
    const routeData = await ensoClient.getRouterData(params);

    // If the tokenIn is ERC20, do approve
    if (args.tokenIn.toLowerCase() !== ENSO_ETH) {
      // NOTE: What about ERC721?
      const tx = await wallet.invokeContract({
        contractAddress: args.tokenIn,
        method: "approve",
        abi: MIN_ERC20_ABI,
        args: {
          spender: routeData.tx.to,
          value: args.amountIn,
        },
      });

      tx.wait();
    }

    if (!routeData.tx.data.startsWith(ENSO_ROUTE_SINGLE_SIG)) {
      return `Unsupported calldata returned from Enso API`;
    }

    // Need to decode the transaction (we know it is routeSingle at this point)
    // TODO: Support all functions, now only routeSingle is supported
    const { args: routeArgs } = decodeFunctionData({
      abi: ENSO_ROUTER_ABI,
      data: routeData.tx.data as Hex,
    });

    const tx = await wallet.invokeContract({
      contractAddress: routeData.tx.to,
      method: "routeSingle",
      abi: ENSO_ROUTER_ABI,
      args: {
        tokenIn: routeArgs[0],
        amountIn: routeArgs[1],
        commands: routeArgs[2],
        state: routeArgs[3],
      },
      amount: BigInt(routeData.tx.value),
      assetId: "wei",
    });

    const result = await tx.wait();
    return `Route executed successfully, transaction hash: ${result.getTransaction().getTransactionHash()}`;
  } catch (error) {
    return `Error routing token through Enso API: ${error}`;
  }
}

/**
 * Enso route action.
 */
export class EnsoRouteAction implements CdpAction<typeof EnsoRouteInput> {
  public name = "enso_route";
  public description = ENSO_ROUTE_PROMPT;
  public argsSchema = EnsoRouteInput;
  public func = ensoRoute;
}
