import { CdpAction } from "../../cdp_action";
import { Wallet } from "@coinbase/coinbase-sdk";
import { EnsoClient, RouteParams } from "@ensofinance/sdk";
import { z } from "zod";
import { ENSO_API_KEY, ENSO_ETH, MIN_ERC20_ABI } from "../constants";
import { Address } from "viem";

// TODO: Write a proper Enso Route prompt
const ENSO_ROUTE_PROMPT = `
`;

//const ENSO_ROUTE_PROMPT = `
//This tool can only be used to buy a Zora Wow ERC20 memecoin (also can be referred to as a bonding curve token) with ETH.
//Do not use this tool for any other purpose, or trading other assets.
//
//Inputs:
//- WOW token contract address
//- Address to receive the tokens
//- Amount of ETH to spend (in wei)
//
//Important notes:
//- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
//- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action.
//- 1 wei = 0.000000000000000001 ETH
//- Minimum purchase amount is 100000000000000 wei (0.0000001 ETH)
//- Only supported on the following networks:
//  - Base Sepolia (ie, 'base-sepolia')
//  - Base Mainnet (ie, 'base', 'base-mainnnet')
//`;

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
    fromAddress: z
      .string()
      .optional()
      .describe(
        "Address of the wallet to send the transaction from. Default - Wallet's default address",
      ),
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
    // Need to verify if the network id is supported
    // NOTE: Supported networks:
    // Ethereum, Arbitrum, Base, Polygon
    const dd = wallet.getNetworkId();

    const fromAddress = (args.fromAddress ||
      (await wallet.getDefaultAddress()).toString()) as Address;

    const params: RouteParams = {
      chainId: 8453,
      tokenIn: args.tokenIn as Address,
      tokenOut: args.tokenOut as Address,
      amountIn: args.amountIn,
      routingStrategy: "router",
      fromAddress,
      receiver: fromAddress,
      spender: fromAddress,
    };

    if (args.slippage) {
      params.slippage = args.slippage;
    }

    const ensoClient = new EnsoClient({ apiKey: ENSO_API_KEY });
    const routeData = await ensoClient.getRouterData(params);

    // NOTE: The plan:
    // 1. Approve
    // 2. Execute the route

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

    // TODO: Setup router call
    const tx = await wallet.invokeContract({
      contractAddress: routeData.tx.to,
      method: "...",
      abi: [],
      args: {},
      amount: BigInt(routeData.tx.value),
      assetId: "wei",
    });

    return "";
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
