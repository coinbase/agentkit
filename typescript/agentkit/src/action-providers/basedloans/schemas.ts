import { z } from "zod";

const amount = z.string().regex(/^\d+(\.\d+)?$/, "Must be a decimal number, e.g. 0.5");
const loanId = z.string().regex(/^\d+$/, "Must be a whole number");
const token = z
  .string()
  .min(1)
  .describe("Token contract address on Base (preferred) or symbol, e.g. WETH or VIRTUAL");
const term = z
  .enum(["short", "medium", "long"])
  .describe("Loan term. Durations and buyback costs come from get_protocol_info");

/**
 * Input schema for actions that take no arguments.
 */
export const EmptySchema = z.object({}).describe("No input");

/**
 * Input schema for listing collateral markets.
 */
export const ListMarketsSchema = z
  .object({
    onlyWithFunds: z
      .boolean()
      .optional()
      .describe("Only return tokens with USDC available to borrow right now"),
  })
  .describe("Instructions for listing Based Loans markets");

/**
 * Input schema for actions that take a single token.
 */
export const TokenSchema = z.object({ token }).describe("Instructions for a token lookup");

/**
 * Input schema for quoting and opening a loan.
 */
export const QuoteSchema = z
  .object({
    token,
    collateralAmount: amount.describe(
      "Collateral to offer, in whole token units, e.g. 0.5. Only what the loan needs is taken",
    ),
    loanAmountUsdc: amount
      .optional()
      .describe(
        "Loan amount in USDC before the fee. Omit to borrow the most the collateral allows",
      ),
    term,
  })
  .describe("Instructions for quoting or opening a loan");

/**
 * Input schema for buying back collateral.
 */
export const BuybackSchema = z
  .object({
    loanId: loanId.describe("Loan ID from get_my_loans"),
    paymentUsdc: amount
      .optional()
      .describe("USDC to pay. Omit to pay everything left and get all collateral back"),
  })
  .describe("Instructions for buying back collateral");

const limits = z
  .array(
    z.object({
      token,
      limitUsdc: amount.describe("Max USDC to lend against this token; 0 removes the limit"),
    }),
  )
  .min(1)
  .max(50);

/**
 * Input schema for depositing USDC to lend.
 */
export const LendSchema = z
  .object({
    amountUsdc: amount.describe("USDC to deposit, e.g. 500"),
    limits: limits
      .optional()
      .describe("Per-token lending limits. A first deposit needs at least one to start lending"),
  })
  .describe("Instructions for depositing USDC to lend");

/**
 * Input schema for setting per-token lending limits.
 */
export const LimitsSchema = z
  .object({ limits: limits.describe("Tokens and the max USDC to lend against each") })
  .describe("Instructions for setting lending limits");

/**
 * Input schema for withdrawing lent USDC.
 */
export const WithdrawSchema = z
  .object({
    amountUsdc: z
      .union([amount, z.literal("max")])
      .describe('USDC to withdraw, or "max" for everything not in active loans'),
    asMusdc: z
      .boolean()
      .optional()
      .describe("Receive mUSDC vault shares instead of USDC, skipping the 0.25% withdrawal fee"),
  })
  .describe("Instructions for withdrawing USDC");

/**
 * Input schema for claiming proceeds or collateral from funded loans.
 */
export const LoanIdsSchema = z
  .object({
    loanIds: z
      .array(loanId)
      .min(1)
      .max(50)
      .describe("IDs of loans this wallet funded, from get_my_lending"),
    mode: z
      .enum(["withdraw", "redeploy"])
      .optional()
      .describe("For proceeds: send USDC to the wallet (default) or put it back into lending"),
  })
  .describe("Instructions for claiming from funded loans");

/**
 * Input schema for checking whether a token can be listed.
 */
export const RequestTokenSchema = z
  .object({
    token: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a token contract address")
      .describe("Token contract address on Base"),
  })
  .describe("Instructions for a token listing check");
