import { CdpAction } from "../../../cdp_action";
import { Wallet } from "@coinbase/coinbase-sdk";
import { WOW_ABI } from "../constants";
import { getHasGraduated } from "../uniswap/utils";
import { getSellQuote } from "../utils";
import { z } from "zod";

const WOW_SELL_TOKEN_PROMPT = `
This tool can only be used to sell a Zora Wow ERC20 memecoin (also can be referred to as a bonding curve token) for ETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- WOW token contract address
- Amount of tokens to sell (in wei)

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action. 
- 1 wei = 0.000000000000000001 ETH
- Minimum purchase amount is 100000000000000 wei (0.0000001 ETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
`;

/**
 * Input schema for sell token action.
 */
export const WowSellTokenInput = z
  .object({
    contractAddress: z
      .string()
      .describe(
        "The WOW token contract address, such as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`",
      ),
    amountTokensInWei: z
      .string()
      .describe(
        "Amount of tokens to sell (in wei), meaning 1 is 1 wei or 0.000000000000000001 of the token",
      ),
  })
  .strip()
  .describe("Instructions for selling WOW tokens");

/**
 * Sells WOW tokens for ETH.
 *
 * @param wallet - The wallet to sell the tokens from.
 * @param args - The input arguments for the action.
 * @returns A message confirming the sale with the transaction hash.
 */
export async function wowSellToken(
  wallet: Wallet,
  args: z.infer<typeof WowSellTokenInput>,
): Promise<string> {
  try {
    const ethQuote = await getSellQuote(
      wallet.getNetworkId(),
      args.contractAddress,
      args.amountTokensInWei,
    );
    const hasGraduated = await getHasGraduated(wallet.getNetworkId(), args.contractAddress);

    // Multiply by 98/100 and floor to get 98% of quote as minimum
    const minEth = (BigInt(Math.floor(Number(ethQuote) * 98)) / BigInt(100)).toString();

    const invocation = await wallet.invokeContract({
      contractAddress: args.contractAddress,
      method: "sell",
      abi: WOW_ABI,
      args: {
        tokensToSell: args.amountTokensInWei,
        recipient: (await wallet.getDefaultAddress()).getId(),
        orderReferrer: "0x0000000000000000000000000000000000000000",
        comment: "",
        expectedMarketType: hasGraduated ? "1" : "0",
        minPayoutSize: minEth,
        sqrtPriceLimitX96: "0",
      },
    });

    const result = await invocation.wait();
    return `Sold WoW ERC20 memecoin with transaction hash: ${result
      .getTransaction()
      .getTransactionHash()}`;
  } catch (error) {
    return `Error selling Zora Wow ERC20 memecoin: ${error}`;
  }
}

/**
 * Zora Wow sell token action.
 */
export class WowSellTokenAction implements CdpAction<typeof WowSellTokenInput> {
  public name = "wow_sell_token";
  public description = WOW_SELL_TOKEN_PROMPT;
  public argsSchema = WowSellTokenInput;
  public func = wowSellToken;
}
