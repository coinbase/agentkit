import { CdpAction } from "../../../cdp_action";
import { Wallet } from "@coinbase/coinbase-sdk";
import { WOW_ABI } from "../constants";
import { getHasGraduated } from "../uniswap/utils";
import { getBuyQuote } from "../utils";
import { z } from "zod";

const WOW_BUY_TOKEN_PROMPT = `
This tool can only be used to buy a Zora Wow ERC20 memecoin (also can be referred to as a bonding curve token) with ETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- WOW token contract address
- Address to receive the tokens  
- Amount of ETH to spend (in wei)

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
 * Input schema for buy token action.
 */
export const WowBuyTokenInput = z
  .object({
    contractAddress: z.string().describe("The WOW token contract address"),
    amountEthInWei: z.string().describe("Amount of ETH to spend (in wei)"),
  })
  .strip()
  .describe("Instructions for buying WOW tokens");

/**
 * Buys a Zora Wow ERC20 memecoin with ETH.
 *
 * @param wallet - The wallet to create the token from.
 * @param args - The input arguments for the action.
 * @returns A message containing the token purchase details.
 */
export async function wowBuyToken(
  wallet: Wallet,
  args: z.infer<typeof WowBuyTokenInput>,
): Promise<string> {
  try {
    const tokenQuote = await getBuyQuote(
      wallet.getNetworkId(),
      args.contractAddress,
      args.amountEthInWei,
    );

    // Multiply by 99/100 and floor to get 99% of quote as minimum
    const minTokens = (BigInt(Math.floor(Number(tokenQuote) * 99)) / BigInt(100)).toString();

    const hasGraduated = await getHasGraduated(wallet.getNetworkId(), args.contractAddress);

    const invocation = await wallet.invokeContract({
      contractAddress: args.contractAddress,
      method: "buy",
      abi: WOW_ABI,
      args: {
        recipient: (await wallet.getDefaultAddress()).getId(),
        refundRecipient: (await wallet.getDefaultAddress()).getId(),
        orderReferrer: "0x0000000000000000000000000000000000000000",
        expectedMarketType: hasGraduated ? "1" : "0",
        minOrderSize: minTokens,
        sqrtPriceLimitX96: "0",
        comment: "",
      },
      amount: BigInt(args.amountEthInWei),
      assetId: "wei",
    });

    const result = await invocation.wait();
    return `Purchased WoW ERC20 memecoin with transaction hash: ${result
      .getTransaction()
      .getTransactionHash()}`;
  } catch (error) {
    return `Error buying Zora Wow ERC20 memecoin: ${error}`;
  }
}

/**
 * Zora Wow buy token action.
 */
export class WowBuyTokenAction implements CdpAction<typeof WowBuyTokenInput> {
  public name = "wow_buy_token";
  public description = WOW_BUY_TOKEN_PROMPT;
  public argsSchema = WowBuyTokenInput;
  public func = wowBuyToken;
}
