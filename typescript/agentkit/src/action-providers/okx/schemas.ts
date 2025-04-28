import { z } from "zod";

/**
 * Schema definition for OKX DEX quote request parameters
 * Based on the OKX DEX API documentation
 */
export const OKXDexQuoteSchema = z.object({
  /**
   * Chain ID (e.g., 501 for Solana)
   * @required
   */
  chainId: z.string().default("501").describe("Chain ID (defaults to 501 for Solana)"),
  
  /**
   * The input amount of a token to be sold in minimal divisible units
   * e.g., 1.00 USDT as 1000000, 1.00 DAI as 1000000000000000000
   * @required
   */
  amount: z.string().describe("The input amount in minimal divisible units"),
  
  /**
   * The contract address of a token to be sold
   * e.g., 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee for native token
   * @required
   */
  fromTokenAddress: z.string().describe("The contract address of the token to be sold"),
  
  /**
   * The contract address of a token to be bought
   * @required
   */
  toTokenAddress: z.string().describe("The contract address of the token to be bought"),
  
  /**
   * DexId of the liquidity pool for limited quotes
   * Multiple combinations separated by commas (e.g., 1,50,180)
   * @optional
   */
  dexIds: z.string().optional().describe("DexId of the liquidity pool, comma-separated"),
  
  /**
   * When enabled, Direct Routes restrict routing to a single liquidity pool only
   * Currently only active for Solana swaps
   * @optional Default: false
   */
  directRoute: z.boolean().optional().describe("Restrict to a single liquidity pool"),
  
  /**
   * The percentage (between 0 - 1.0) of the price impact allowed
   * Returns error if estimated price impact is above this percentage
   * @optional Default: 0.9 (90%)
   */
  priceImpactProtectionPercentage: z.string().optional().describe("The percentage (0-1.0) of price impact allowed"),
  
  /**
   * The percentage of fromTokenAmount that will be sent to the referrer's address
   * Min: 0, Max: 3, up to 2 decimal places
   * @optional
   */
  feePercent: z.string().optional().describe("Percentage of token amount sent to referrer (0-3%)"),
});

/**
 * Type definition for the OKX DEX quote response
 * Based on the OKX DEX API documentation
 */
export interface OKXDexQuoteResponse {
  code: string;
  data: Array<{
    chainId: string;
    dexRouterList: Array<{
      router: string;
      routerPercent: string;
      subRouterList: Array<{
        dexProtocol: Array<{
          dexName: string;
          percent: string;
        }>;
        fromToken: {
          decimal: string;
          isHoneyPot: boolean;
          taxRate: string;
          tokenContractAddress: string;
          tokenSymbol: string;
          tokenUnitPrice: string;
        };
        toToken: {
          decimal: string;
          isHoneyPot: boolean;
          taxRate: string;
          tokenContractAddress: string;
          tokenSymbol: string;
          tokenUnitPrice: string;
        };
      }>;
    }>;
    estimateGasFee: string;
    fromToken: {
      decimal: string;
      isHoneyPot: boolean;
      taxRate: string;
      tokenContractAddress: string;
      tokenSymbol: string;
      tokenUnitPrice: string;
    };
    fromTokenAmount: string;
    originToTokenAmount: string;
    priceImpactPercentage: string;
    quoteCompareList: Array<{
      amountOut: string;
      dexLogo: string;
      dexName: string;
      tradeFee: string;
    }>;
    toToken: {
      decimal: string;
      isHoneyPot: boolean;
      taxRate: string;
      tokenContractAddress: string;
      tokenSymbol: string;
      tokenUnitPrice: string;
    };
    toTokenAmount: string;
    tradeFee: string;
  }>;
  msg: string;
}