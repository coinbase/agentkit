import { z } from "zod";

/**
 * Schema definition for OKX DEX quote request parameters
 * Based on the OKX DEX API documentation
 */
export const OKXDexQuoteSchema = z.object({
  /**
   * Chain ID (e.g., 501 for Solana, 1 for Ethereum)
   * @required
   */
  chainId: z.string().nullable().default("501").describe("Chain ID (defaults to 501 for Solana)"),

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
   * Slippage limit between 0-1
   * For EVM: min 0, max 1
   * For Solana: min 0, max < 1
   * @optional
   */
  slippage: z.string().nullable().describe("Slippage limit (0-1, e.g., 0.005 for 0.5%)"),

  /**
   * DexId of the liquidity pool for limited quotes
   * Multiple combinations separated by commas (e.g., 1,50,180)
   * @optional
   */
  dexIds: z.string().nullable().describe("DexId of the liquidity pool, comma-separated"),

  /**
   * When enabled, Direct Routes restrict routing to a single liquidity pool only
   * Currently only active for Solana swaps
   * @optional Default: false
   */
  directRoute: z.boolean().nullable().describe("Restrict to a single liquidity pool"),

  /**
   * The percentage (between 0 - 1.0) of the price impact allowed
   * Returns error if estimated price impact is above this percentage
   * @optional Default: 0.9 (90%)
   */
  priceImpactProtectionPercentage: z.string().nullable().describe("The percentage (0-1.0) of price impact allowed"),

  /**
   * Auto slippage calculation flag
   * @optional Default: false
   */
  autoSlippage: z.boolean().nullable().describe("Calculate and return auto slippage recommendations"),

  /**
   * Maximum auto slippage when autoSlippage is true
   * @optional
   */
  maxAutoSlippage: z.string().nullable().describe("Maximum auto slippage to use"),
});

/**
 * Schema for swap transaction request
 */
export const OKXDexSwapSchema = z.object({
  /**
   * Chain ID (e.g., 501 for Solana, 1 for Ethereum)
   * @required
   */
  chainId: z.string().nullable().describe("Chain ID (defaults to 501 for Solana)"),

  /**
   * The input amount of a token to be sold in minimal divisible units
   * @required
   */
  amount: z.string().describe("The input amount in minimal divisible units"),

  /**
   * The contract address of a token to be sold
   * @required
   */
  fromTokenAddress: z.string().describe("The contract address of the token to be sold"),

  /**
   * The contract address of a token to be bought
   * @required
   */
  toTokenAddress: z.string().describe("The contract address of the token to be bought"),

  /**
   * Slippage limit between 0-1
   * @required
   */
  slippage: z.string().describe("Slippage limit (0-1, e.g., 0.005 for 0.5%)"),

  /**
   * User's wallet address
   * @required
   */
  userWalletAddress: z.string().describe("User's wallet address"),

  /**
   * Recipient address of purchased token (if not set, userWalletAddress is used)
   * @optional
   */
  swapReceiverAddress: z.string().nullable().describe("Recipient address of purchased token"),

  /**
   * Referrer fee percentage (0-3%, max 2 decimal points)
   * @optional
   */
  feePercent: z.string().nullable().describe("Referrer fee percentage (0-3%)"),

  /**
   * Wallet address to receive commission from fromToken
   * @optional
   */
  fromTokenReferrerWalletAddress: z.string().nullable().describe("Wallet address to receive commission from fromToken"),

  /**
   * Wallet address to receive commission from toToken
   * @optional
   */
  toTokenReferrerWalletAddress: z.string().nullable().describe("Wallet address to receive commission from toToken"),

  /**
   * Send positive slippage revenue to referrer's address
   * @optional Default: false
   */
  enablePositiveSlippage: z.boolean().nullable().describe("Send positive slippage revenue to referrer"),

  /**
   * Gas limit for swap transaction
   * @optional
   */
  gaslimit: z.string().nullable().describe("Gas limit for swap transaction"),

  /**
   * Gas price level (average, fast, slow)
   * @optional Default: average
   */
  gasLevel: z.string().nullable().describe("Gas price level (average, fast, slow)"),

  /**
   * DexId of the liquidity pool for limited quotes
   * @optional
   */
  dexIds: z.string().nullable().describe("DexId of the liquidity pool, comma-separated"),

  /**
   * Restrict routing to a single liquidity pool
   * @optional Default: false
   */
  directRoute: z.boolean().nullable().describe("Restrict to a single liquidity pool"),

  /**
   * Price impact protection percentage
   * @optional Default: 0.9 (90%)
   */
  priceImpactProtectionPercentage: z.string().nullable().describe("Price impact protection percentage (0-1.0)"),

  /**
   * Custom data to be sent in callData (128-char hex string)
   * @optional
   */
  callDataMemo: z.string().nullable().describe("Custom callData parameter (128-char hex string)"),

  /**
   * Solana compute unit price for transaction priority
   * @optional
   */
  computeUnitPrice: z.string().nullable().describe("Solana compute unit price (similar to gasPrice)"),

  /**
   * Solana compute unit limit for transaction
   * @optional
   */
  computeUnitLimit: z.string().nullable().describe("Solana compute unit limit (similar to gasLimit)"),

  /**
   * Auto slippage calculation flag
   * @optional Default: false
   */
  autoSlippage: z.boolean().nullable().describe("Calculate and use auto slippage recommendations"),

  /**
   * Maximum auto slippage when autoSlippage is true
   * @optional
   */
  maxAutoSlippage: z.string().nullable().describe("Maximum auto slippage to use"),
});

/**
 * Schema for broadcast transaction request
 */
export const OKXDexBroadcastSchema = z.object({
  /**
   * The transaction string after being signed
   * @required
   */
  signedTx: z.string().describe("The signed transaction string"),

  /**
   * Unique identifier for the chain
   * @required
   */
  chainIndex: z.string().describe("Chain index (e.g., 3 for ETH, 27 for Solana)"),

  /**
   * Wallet address
   * @required
   */
  address: z.string().describe("Wallet address"),

  /**
   * Wallet account ID
   * @optional
   */
  accountId: z.string().optional().describe("Wallet account ID"),
});

/**
 * Type definition for the OKX DEX quote response
 */
export interface OKXDexQuoteResponse {
  code: string;
  data: Array<{
    routerResult: {
      chainId: string;
      fromTokenAmount: string;
      toTokenAmount: string;
      tradeFee: string;
      estimateGasFee: string;
      dexRouterList: Array<{
        router: string;
        routerPercent: string;
        subRouterList: Array<{
          dexProtocol: Array<{
            dexName: string;
            percent: string;
          }>;
          fromToken: TokenInfo;
          toToken: TokenInfo;
        }>;
      }>;
      fromToken: TokenInfo;
      toToken: TokenInfo;
      priceImpactPercentage: string;
      quoteCompareList: Array<{
        amountOut: string;
        dexLogo: string;
        dexName: string;
        tradeFee: string;
      }>;
    };
    tx: {
      signatureData: string[];
      from: string;
      gas: string;
      gasPrice: string;
      maxPriorityFeePerGas?: string;
      to: string;
      value: string;
      minReceiveAmount: string;
      data: string;
      slippage: string;
    };
  }>;
  msg: string;
}

/**
 * Type definition for token information in responses
 */
export interface TokenInfo {
  tokenContractAddress: string;
  tokenSymbol: string;
  tokenUnitPrice: string;
  decimal: string;
  isHoneyPot: boolean;
  taxRate: string;
}

/**
 * Type definition for broadcast transaction response
 */
export interface OKXDexBroadcastResponse {
  code: string;
  data: Array<{
    orderId: string;
  }>;
  msg: string;
}