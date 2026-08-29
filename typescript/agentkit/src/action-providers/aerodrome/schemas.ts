import { z } from "zod";

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
const amountRegex = /^\d+(\.\d+)?$/;
const tokenIdRegex = /^\d+$/;

/**
 * Input schema for getting a swap quote on Aerodrome.
 */
export const AerodromeGetQuoteSchema = z
  .object({
    tokenIn: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the input token"),
    tokenOut: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the output token"),
    amountIn: z
      .string()
      .regex(amountRegex, "Must be a valid integer or decimal value")
      .describe("The amount of input tokens in whole units (e.g., '1.5' for 1.5 tokens)"),
    stable: z
      .boolean()
      .default(false)
      .describe(
        "Whether to use the stable pool (for correlated assets like USDC/USDbC) or volatile pool (default)",
      ),
  })
  .refine(data => data.tokenIn.toLowerCase() !== data.tokenOut.toLowerCase(), {
    message: "tokenIn and tokenOut must be different tokens",
  })
  .describe("Input schema for getting a swap quote on Aerodrome");

/**
 * Input schema for swapping tokens on Aerodrome.
 */
export const AerodromeSwapSchema = z
  .object({
    tokenIn: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the input token"),
    tokenOut: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the output token"),
    amountIn: z
      .string()
      .regex(amountRegex, "Must be a valid integer or decimal value")
      .describe("The amount of input tokens in whole units (e.g., '1.5' for 1.5 tokens)"),
    slippageBps: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .describe("Maximum slippage in basis points (100 = 1%, max 1000 = 10%). Default is 1%"),
    stable: z
      .boolean()
      .default(false)
      .describe(
        "Whether to use the stable pool (for correlated assets like USDC/USDbC) or volatile pool (default)",
      ),
  })
  .refine(data => data.tokenIn.toLowerCase() !== data.tokenOut.toLowerCase(), {
    message: "tokenIn and tokenOut must be different tokens",
  })
  .describe("Input schema for swapping tokens on Aerodrome");

/**
 * Input schema for adding liquidity on Aerodrome.
 */
export const AerodromeAddLiquiditySchema = z
  .object({
    tokenA: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the first token"),
    tokenB: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the second token"),
    amountA: z
      .string()
      .regex(amountRegex, "Must be a valid integer or decimal value")
      .describe("The amount of the first token in whole units (e.g., '1.5')"),
    amountB: z
      .string()
      .regex(amountRegex, "Must be a valid integer or decimal value")
      .describe("The amount of the second token in whole units (e.g., '1.5')"),
    stable: z
      .boolean()
      .default(false)
      .describe("Whether this is a stable pool (for correlated assets) or volatile pool (default)"),
    slippageBps: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .describe("Maximum slippage in basis points (100 = 1%, max 1000 = 10%). Default is 1%"),
  })
  .refine(data => data.tokenA.toLowerCase() !== data.tokenB.toLowerCase(), {
    message: "tokenA and tokenB must be different tokens",
  })
  .describe("Input schema for adding liquidity on Aerodrome");

/**
 * Input schema for removing liquidity on Aerodrome.
 */
export const AerodromeRemoveLiquiditySchema = z
  .object({
    tokenA: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the first token"),
    tokenB: z
      .string()
      .regex(addressRegex, "Invalid Ethereum address format")
      .describe("The address of the second token"),
    liquidity: z
      .string()
      .regex(amountRegex, "Must be a valid integer or decimal value")
      .describe("The amount of LP tokens to remove in whole units"),
    stable: z
      .boolean()
      .default(false)
      .describe("Whether this is a stable pool or volatile pool"),
    slippageBps: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .describe("Maximum slippage in basis points (100 = 1%, max 1000 = 10%). Default is 1%"),
  })
  .refine(data => data.tokenA.toLowerCase() !== data.tokenB.toLowerCase(), {
    message: "tokenA and tokenB must be different tokens",
  })
  .describe("Input schema for removing liquidity on Aerodrome");

/**
 * Input schema for creating a veAERO lock on Aerodrome.
 */
export const AerodromeCreateLockSchema = z
  .object({
    amount: z
      .string()
      .regex(amountRegex, "Must be a valid integer or decimal value")
      .describe("The amount of AERO tokens to lock in whole units (e.g., '100')"),
    lockDurationDays: z
      .number()
      .int()
      .min(7)
      .max(1460)
      .describe(
        "Lock duration in days (minimum 7 days, maximum 1460 days / 4 years). Longer locks give more voting power. Duration is rounded down to the nearest Thursday epoch boundary on-chain",
      ),
  })
  .describe("Input schema for creating a veAERO lock on Aerodrome");

/**
 * Input schema for voting with veAERO on Aerodrome.
 */
export const AerodromeVoteSchema = z
  .object({
    tokenId: z
      .string()
      .regex(tokenIdRegex, "Must be a valid token ID")
      .refine(s => BigInt(s) > 0n, "tokenId must be a positive number")
      .describe("The veAERO NFT token ID to vote with"),
    pools: z
      .array(z.string().regex(addressRegex, "Invalid Ethereum address format"))
      .min(1)
      .describe("Array of pool addresses to vote for"),
    weights: z
      .array(z.number().int().min(1))
      .min(1)
      .describe(
        "Array of vote weights for each pool (relative, normalized by the contract). Must match pools array length",
      ),
  })
  .refine(data => data.pools.length === data.weights.length, {
    message: "pools and weights arrays must have the same length",
  })
  .describe("Input schema for voting with veAERO on Aerodrome");

/**
 * Input schema for increasing the locked AERO amount in an existing veAERO position.
 */
export const AerodromeIncreaseAmountSchema = z
  .object({
    tokenId: z
      .string()
      .regex(tokenIdRegex, "Must be a valid token ID")
      .refine(s => BigInt(s) > 0n, "tokenId must be a positive number")
      .describe("The veAERO NFT token ID to add more AERO to"),
    amount: z
      .string()
      .regex(amountRegex, "Must be a valid integer or decimal value")
      .describe("The additional amount of AERO tokens to lock in whole units"),
  })
  .describe("Input schema for increasing locked AERO amount on Aerodrome");

/**
 * Input schema for extending the lock duration of an existing veAERO position.
 */
export const AerodromeIncreaseUnlockTimeSchema = z
  .object({
    tokenId: z
      .string()
      .regex(tokenIdRegex, "Must be a valid token ID")
      .refine(s => BigInt(s) > 0n, "tokenId must be a positive number")
      .describe("The veAERO NFT token ID to extend the lock for"),
    additionalDays: z
      .number()
      .int()
      .min(7)
      .max(1460)
      .describe("Additional days to extend the lock (total lock cannot exceed 4 years)"),
  })
  .describe("Input schema for extending veAERO lock duration on Aerodrome");

/**
 * Input schema for withdrawing unlocked AERO from an expired veAERO position.
 */
export const AerodromeWithdrawSchema = z
  .object({
    tokenId: z
      .string()
      .regex(tokenIdRegex, "Must be a valid token ID")
      .refine(s => BigInt(s) > 0n, "tokenId must be a positive number")
      .describe("The veAERO NFT token ID to withdraw from (lock must be expired)"),
  })
  .describe("Input schema for withdrawing unlocked AERO from Aerodrome");

/**
 * Input schema for claiming trading fees and bribes from voted pools.
 */
export const AerodromeClaimRewardsSchema = z
  .object({
    tokenId: z
      .string()
      .regex(tokenIdRegex, "Must be a valid token ID")
      .refine(s => BigInt(s) > 0n, "tokenId must be a positive number")
      .describe("The veAERO NFT token ID to claim rewards for"),
    pools: z
      .array(z.string().regex(addressRegex, "Invalid Ethereum address format"))
      .min(1)
      .describe("Array of pool addresses to claim fees and bribes from"),
    feeTokens: z
      .array(z.array(z.string().regex(addressRegex, "Invalid Ethereum address format")))
      .min(1)
      .describe(
        "Array of arrays of fee token addresses per pool. Fee tokens are the pool's underlying tokens (e.g., [WETH, USDC] for the WETH/USDC pool)",
      ),
    bribeTokens: z
      .array(z.array(z.string().regex(addressRegex, "Invalid Ethereum address format")))
      .min(1)
      .describe(
        "Array of arrays of bribe reward token addresses per pool. Bribe tokens are incentive tokens deposited by protocols (may differ from the pool's underlying tokens)",
      ),
  })
  .refine(
    data =>
      data.pools.length === data.feeTokens.length &&
      data.pools.length === data.bribeTokens.length,
    { message: "pools, feeTokens, and bribeTokens arrays must have the same length" },
  )
  .describe("Input schema for claiming Aerodrome fees and bribes");
